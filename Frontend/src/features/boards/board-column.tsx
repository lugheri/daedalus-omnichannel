import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { BoardColumn as Column, DealView } from './api'
import { SortableDealCard, type DealActions } from './board-card-item'

export interface ColumnActions {
  rename: () => void
  moveLeft?: () => void
  moveRight?: () => void
  remove: () => void
  automations: () => void
  /** Regras da etapa (ativas ou não). */
  automationCount: number
}

/** Uma etapa: cabeçalho (quantos e quanto), negócios (soltáveis mesmo vazia) e "carregar mais". */
export function BoardColumnView({
  column,
  columns,
  deals,
  hasMore,
  loadingMore,
  onLoadMore,
  dealActions,
  onNewDeal,
  actions,
}: {
  column: Column
  columns: Column[]
  deals: DealView[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  dealActions: (deal: DealView) => DealActions
  onNewDeal: () => void
  /** Só para quem gerencia funis. */
  actions?: ColumnActions
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const total = deals.reduce((sum, d) => sum + (d.valueCents ?? 0), 0)

  return (
    <section
      aria-label={`Etapa ${column.name}`}
      className="bg-muted/50 flex max-h-full w-72 shrink-0 flex-col rounded-lg border"
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {column.name}
            <span className="text-muted-foreground ml-2 font-normal">
              {deals.length}
              {hasMore && '+'}
            </span>
          </h2>
          {total > 0 && (
            <p
              className="text-muted-foreground text-xs tabular-nums"
              title="Soma dos valores na etapa"
            >
              {formatMoney(total)}
              {hasMore && '+'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Novo negócio em ${column.name}`}
            title="Novo negócio nesta etapa"
            onClick={onNewDeal}
          >
            <Plus />
          </Button>
          {actions && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 gap-1 px-1.5',
                  actions.automationCount === 0 && 'text-muted-foreground',
                )}
                aria-label={`Automações da etapa ${column.name} (${actions.automationCount})`}
                title="Automações"
                onClick={actions.automations}
              >
                <Zap />
                {actions.automationCount > 0 && actions.automationCount}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Ações da etapa ${column.name}`}
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
                    Excluir etapa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            'flex min-h-20 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2',
            isOver && 'bg-accent/50 rounded-b-lg',
          )}
        >
          {deals.map((deal) => (
            <SortableDealCard
              key={deal.id}
              deal={deal}
              columns={columns}
              actions={dealActions(deal)}
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
