import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowRight, ExternalLink, GripVertical, MoreHorizontal, Trash2 } from 'lucide-react'
import type { KeyboardEventHandler, ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDispositionLookup } from '@/features/dispositions/api'
import { DispositionBadge } from '@/features/dispositions/disposition-badge'
import { contactLabel } from '@/features/conversations/format'
import { useMemberNames } from '@/features/members/api'
import { cn } from '@/lib/utils'
import type { BoardCard, BoardColumn } from './api'

const STATUS_LABEL = { pending: 'Aguardando cliente', resolved: 'Resolvida' } as const

/** "há 5 min", "há 3 h", "há 2 d" — tempo na coluna atual. */
function since(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  return `há ${Math.floor(hours / 24)} d`
}

const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Conteúdo do card (também usado no "fantasma" que acompanha o arraste). */
export function CardContent({
  card,
  columns,
  onMove,
  onRemove,
  handle,
}: {
  card: BoardCard
  /** Alça de arraste pelo teclado (só no card do quadro). */
  handle?: ReactNode
  columns?: BoardColumn[]
  onMove?: (columnId: string) => void
  onRemove?: () => void
}) {
  const nameOf = useMemberNames()
  const dispositionOf = useDispositionLookup()
  const { conversation } = card
  const disposition = dispositionOf(conversation.dispositionId)

  return (
    <div className="bg-card flex flex-col gap-1.5 rounded-md border p-2.5 text-sm shadow-xs">
      <div className="flex items-start justify-between gap-2">
        {handle}
        <Link
          to={`/conversations/${conversation.id}?status=${conversation.status}`}
          className="min-w-0 flex-1 truncate font-medium hover:underline"
        >
          {contactLabel(conversation.contact)}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {conversation.unreadCount > 0 && (
            <Badge className="h-5 min-w-5 rounded-full px-1.5">{conversation.unreadCount}</Badge>
          )}
          {onMove && columns && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Ações do card de ${contactLabel(conversation.contact)}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/conversations/${conversation.id}?status=${conversation.status}`}>
                    <ExternalLink />
                    Abrir conversa
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                {columns
                  .filter((c) => c.id !== card.columnId)
                  .map((column) => (
                    <DropdownMenuItem key={column.id} onSelect={() => onMove(column.id)}>
                      <ArrowRight />
                      {column.name}
                    </DropdownMenuItem>
                  ))}
                {onRemove && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                      <Trash2 />
                      Remover do quadro
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs">
        {conversation.lastMessagePreview ?? '—'}
      </p>
      {(disposition || conversation.status !== 'open') && (
        <div className="flex flex-wrap gap-1">
          {disposition && <DispositionBadge disposition={disposition} />}
          {conversation.status !== 'open' && (
            <Badge variant="outline">{STATUS_LABEL[conversation.status]}</Badge>
          )}
        </div>
      )}
      <div className="text-muted-foreground flex justify-between gap-2 text-xs">
        <span className="truncate">{nameOf(conversation.assigneeId) ?? 'Sem responsável'}</span>
        <span
          className="shrink-0"
          title={`Nesta coluna desde ${fullDate.format(new Date(card.enteredColumnAt))}`}
        >
          {since(card.enteredColumnAt)}
        </span>
      </div>
    </div>
  )
}

/**
 * Card arrastável. Mouse e toque: arraste o card por qualquer ponto. Teclado:
 * a alça (botão) pega o card com espaço, as setas movem, espaço solta e Esc
 * cancela. A alça é o único elemento com papel de botão — o card continua
 * sendo um item de lista com link e menu dentro.
 */
export function SortableCard({
  card,
  columns,
  onMove,
  onRemove,
}: {
  card: BoardCard
  columns: BoardColumn[]
  onMove: (columnId: string) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })
  const { onKeyDown, ...pointer } = listeners ?? {}
  const name = contactLabel(card.conversation.contact)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('touch-manipulation list-none', isDragging && 'opacity-40')}
      aria-label={`Card de ${name}`}
      {...pointer}
    >
      <CardContent
        card={card}
        columns={columns}
        onMove={onMove}
        onRemove={onRemove}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
            aria-label={`Mover card de ${name}`}
            className="text-muted-foreground hover:bg-accent focus-visible:ring-ring -ml-1 cursor-grab rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  )
}
