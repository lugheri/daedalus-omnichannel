import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { BoardCard, BoardColumn as Column } from './api'
import { SortableCard } from './board-card-item'

export interface ColumnActions {
  rename: () => void
  moveLeft?: () => void
  moveRight?: () => void
  remove: () => void
}

/** Uma coluna: cabeçalho, cards (soltáveis mesmo vazia) e "carregar mais". */
export function BoardColumnView({
  column,
  columns,
  cards,
  hasMore,
  loadingMore,
  onLoadMore,
  onMoveCard,
  onRemoveCard,
  actions,
}: {
  column: Column
  columns: Column[]
  cards: BoardCard[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onMoveCard: (card: BoardCard, columnId: string) => void
  onRemoveCard: (card: BoardCard) => void
  /** Só para quem gerencia quadros. */
  actions?: ColumnActions
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <section
      aria-label={`Coluna ${column.name}`}
      className="bg-muted/50 flex max-h-full w-72 shrink-0 flex-col rounded-lg border"
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">
          {column.name}
          <span className="text-muted-foreground ml-2 font-normal">
            {cards.length}
            {hasMore && '+'}
          </span>
        </h2>
        {actions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Ações da coluna ${column.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={actions.rename}>
                <Pencil />
                Renomear
              </DropdownMenuItem>
              {actions.moveLeft && (
                <DropdownMenuItem onSelect={actions.moveLeft}>
                  <ArrowLeft />
                  Mover para a esquerda
                </DropdownMenuItem>
              )}
              {actions.moveRight && (
                <DropdownMenuItem onSelect={actions.moveRight}>
                  <ArrowRight />
                  Mover para a direita
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={actions.remove}>
                <Trash2 />
                Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            'flex min-h-20 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2',
            isOver && 'bg-accent/50 rounded-b-lg',
          )}
        >
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              columns={columns}
              onMove={(columnId) => onMoveCard(card, columnId)}
              onRemove={() => onRemoveCard(card)}
            />
          ))}
          {hasMore && (
            <li className="list-none">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={loadingMore}
                onClick={onLoadMore}
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}
