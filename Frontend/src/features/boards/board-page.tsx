import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Settings } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { errorMessage } from '@/lib/api/api-error'
import {
  boardKeys,
  boardsApi,
  dealsApi,
  useBoard,
  useBoardDeals,
  type Board,
  type BoardColumn,
  type ColumnPage,
  type DealView,
} from './api'
import { DealCardContent, type DealActions } from './board-card-item'
import { BoardColumnView } from './board-column'
import { BoardSettingsDialog, ColumnNameDialog, DeleteColumnDialog } from './board-dialogs'
import { DealDialog, NewDealDialog } from './deal-dialogs'
import { refreshDeals } from './deal-format'
import { useAutomations } from './automations/api'
import { AutomationsDialog } from './automations/automations-dialog'

/** Ids dos negócios de cada etapa, na ordem. */
type Layout = Record<string, string[]>

type ColumnDialog =
  | { kind: 'add' }
  | { kind: 'rename'; column: BoardColumn }
  | { kind: 'delete'; column: BoardColumn }
  | { kind: 'automations'; column: BoardColumn }

export function BoardPage() {
  const { id = '' } = useParams()
  const board = useBoard(id)
  const cards = useBoardDeals(id)

  if (board.isError) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
        {errorMessage(board.error)}
      </div>
    )
  }
  if (!board.data || !cards.data) {
    return (
      <div className="flex gap-3 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-72" />
        ))}
      </div>
    )
  }
  return <BoardView board={board.data} pages={cards.data} />
}

function BoardView({ board, pages }: { board: Board; pages: ColumnPage[] }) {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const manage = can('boards:manage')
  const [settings, setSettings] = useState(false)
  const [columnDialog, setColumnDialog] = useState<ColumnDialog | null>(null)
  const [loadingMore, setLoadingMore] = useState<string | null>(null)
  const [openDeal, setOpenDeal] = useState<{ id: string; losing: boolean } | null>(null)
  const [newDealIn, setNewDealIn] = useState<string | null>(null)
  const automations = useAutomations(board.id, manage)
  const rulesOf = (columnId: string) =>
    automations.data?.filter((rule) => rule.columnId === columnId) ?? []

  const pageOf = useMemo(() => new Map(pages.map((p) => [p.columnId, p])), [pages])
  const cardById = useMemo(
    () => new Map(pages.flatMap((p) => p.deals).map((d) => [d.id, d])),
    [pages],
  )
  const base: Layout = useMemo(
    () =>
      Object.fromEntries(
        board.columns.map((c) => [c.id, (pageOf.get(c.id)?.deals ?? []).map((deal) => deal.id)]),
      ),
    [board.columns, pageOf],
  )

  // Durante o arraste, a ordem da tela é local; ao soltar, vai para a API. O
  // ref acompanha o estado sem esperar a renderização: um "soltar" logo depois
  // de um "passar por cima" (teclado rápido) não pode ler a ordem antiga.
  const [dragLayout, setDragLayoutState] = useState<Layout | null>(null)
  const dragLayoutRef = useRef<Layout | null>(null)
  const setDragLayout = (next: Layout | null) => {
    dragLayoutRef.current = next
    setDragLayoutState(next)
  }
  const [activeId, setActiveId] = useState<string | null>(null)
  const layout = dragLayout ?? base

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const refresh = () => refreshDeals(queryClient)

  const move = useMutation({
    mutationFn: (input: { cardId: string; columnId: string; afterCardId: string | null }) =>
      dealsApi.move(input.cardId, input.columnId, input.afterCardId),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  })

  const win = useMutation({
    mutationFn: (deal: DealView) => dealsApi.setStatus(deal.id, { status: 'won' }),
    onSuccess: (deal) => toast.success(`${deal.title}: negócio ganho!`),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  })

  const moveColumn = useMutation({
    mutationFn: ({ column, index }: { column: BoardColumn; index: number }) =>
      boardsApi.updateColumn(board.id, column.id, { index }),
    onSuccess: (updated) => queryClient.setQueryData(boardKeys.detail(board.id), updated),
    onError: (error) => toast.error(errorMessage(error)),
  })

  /** Aplica a nova ordem no cache na hora (a API confirma em seguida). */
  const applyLocally = (next: Layout) => {
    queryClient.setQueryData<ColumnPage[]>(boardKeys.deals(board.id), (current) =>
      current?.map((page) => ({
        ...page,
        deals: (next[page.columnId] ?? []).flatMap((dealId) => {
          const deal = cardById.get(dealId)
          return deal ? [{ ...deal, columnId: page.columnId }] : []
        }),
      })),
    )
  }

  /** Move pelo menu "Mover para": topo da etapa escolhida. */
  const moveToColumn = (card: DealView, columnId: string) => {
    const next = { ...layout }
    next[card.columnId] = next[card.columnId].filter((cid) => cid !== card.id)
    next[columnId] = [card.id, ...next[columnId]]
    applyLocally(next)
    move.mutate({ cardId: card.id, columnId, afterCardId: null })
  }

  const containerOf = (itemId: string, current: Layout) =>
    itemId in current ? itemId : Object.keys(current).find((col) => current[col].includes(itemId))

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setDragLayout(base)
  }

  // Passou para outra etapa: o negócio entra nela na posição do item sob o cursor.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const current = dragLayoutRef.current
    if (!over || !current) return
    const from = containerOf(String(active.id), current)
    const to = containerOf(String(over.id), current)
    if (!from || !to || from === to) return
    const target = current[to]
    const overIndex = target.indexOf(String(over.id))
    const index = overIndex >= 0 ? overIndex : target.length
    setDragLayout({
      ...current,
      [from]: current[from].filter((cid) => cid !== active.id),
      [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const cardId = String(active.id)
    let next = dragLayoutRef.current ?? base
    setActiveId(null)
    setDragLayout(null)
    if (!over) return

    const column = containerOf(cardId, next)
    const overColumn = containerOf(String(over.id), next)
    if (!column || !overColumn) return
    if (column === overColumn && over.id !== column) {
      const list = next[column]
      next = {
        ...next,
        [column]: arrayMove(list, list.indexOf(cardId), list.indexOf(String(over.id))),
      }
    }

    const index = next[column].indexOf(cardId)
    const afterCardId = next[column][index - 1] ?? null
    const card = cardById.get(cardId)
    if (!card) return
    const original = base[card.columnId]
    const originalAfter = original[original.indexOf(cardId) - 1] ?? null
    if (card.columnId === column && originalAfter === afterCardId) return

    applyLocally(next)
    move.mutate({ cardId, columnId: column, afterCardId })
  }

  const loadMore = async (columnId: string) => {
    const cursor = pageOf.get(columnId)?.nextCursor
    if (!cursor) return
    setLoadingMore(columnId)
    try {
      const [more] = await boardsApi.deals(board.id, { columnId, cursor })
      queryClient.setQueryData<ColumnPage[]>(boardKeys.deals(board.id), (current) =>
        current?.map((page) =>
          page.columnId === columnId
            ? { ...page, deals: [...page.deals, ...more.deals], nextCursor: more.nextCursor }
            : page,
        ),
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoadingMore(null)
    }
  }

  const activeCard = activeId ? cardById.get(activeId) : undefined
  const dealActions = (deal: DealView): DealActions => ({
    open: () => setOpenDeal({ id: deal.id, losing: false }),
    move: (columnId) => moveToColumn(deal, columnId),
    win: () => win.mutate(deal),
    lose: () => setOpenDeal({ id: deal.id, losing: true }),
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2 md:px-4">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar aos funis">
          <Link to="/boards">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{board.name}</h1>
        <Button size="sm" onClick={() => setNewDealIn(board.columns[0].id)}>
          <Plus />
          Novo negócio
        </Button>
        {manage && (
          <>
            <Button variant="outline" size="sm" onClick={() => setColumnDialog({ kind: 'add' })}>
              <Plus />
              Nova etapa
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Configurar funil"
              title="Configurar funil"
              onClick={() => setSettings(true)}
            >
              <Settings />
            </Button>
          </>
        )}
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setDragLayout(null)
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Para mover o negócio, pressione espaço. Use as setas para escolher o lugar e espaço de novo para soltar, ou Esc para cancelar.',
          },
        }}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 md:p-4">
          {board.columns.map((column, index) => (
            <BoardColumnView
              key={column.id}
              column={column}
              columns={board.columns}
              deals={(layout[column.id] ?? []).flatMap((did) => cardById.get(did) ?? [])}
              hasMore={!!pageOf.get(column.id)?.nextCursor}
              loadingMore={loadingMore === column.id}
              onLoadMore={() => void loadMore(column.id)}
              dealActions={dealActions}
              onNewDeal={() => setNewDealIn(column.id)}
              actions={
                manage
                  ? {
                      rename: () => setColumnDialog({ kind: 'rename', column }),
                      moveLeft:
                        index > 0
                          ? () => moveColumn.mutate({ column, index: index - 1 })
                          : undefined,
                      moveRight:
                        index < board.columns.length - 1
                          ? () => moveColumn.mutate({ column, index: index + 1 })
                          : undefined,
                      remove: () => setColumnDialog({ kind: 'delete', column }),
                      automations: () => setColumnDialog({ kind: 'automations', column }),
                      automationCount: rulesOf(column.id).length,
                    }
                  : undefined
              }
            />
          ))}
        </div>
        <DragOverlay>{activeCard && <DealCardContent deal={activeCard} />}</DragOverlay>
      </DndContext>

      {openDeal && (
        <DealDialog
          dealId={openDeal.id}
          losing={openDeal.losing}
          onOpenChange={() => setOpenDeal(null)}
        />
      )}
      {newDealIn && (
        <NewDealDialog
          board={board}
          columnId={newDealIn}
          open
          onOpenChange={() => setNewDealIn(null)}
        />
      )}

      {settings && <BoardSettingsDialog board={board} open onOpenChange={setSettings} />}
      {columnDialog?.kind === 'add' && (
        <ColumnNameDialog board={board} open onOpenChange={() => setColumnDialog(null)} />
      )}
      {columnDialog?.kind === 'rename' && (
        <ColumnNameDialog
          board={board}
          column={columnDialog.column}
          open
          onOpenChange={() => setColumnDialog(null)}
        />
      )}
      {columnDialog?.kind === 'automations' && (
        <AutomationsDialog
          board={board}
          column={columnDialog.column}
          rules={rulesOf(columnDialog.column.id)}
          open
          onOpenChange={() => setColumnDialog(null)}
        />
      )}
      {columnDialog?.kind === 'delete' && (
        <DeleteColumnDialog
          board={board}
          column={columnDialog.column}
          hasCards={
            (base[columnDialog.column.id]?.length ?? 0) > 0 ||
            !!pageOf.get(columnDialog.column.id)?.nextCursor
          }
          open
          onOpenChange={() => setColumnDialog(null)}
        />
      )}
    </div>
  )
}
