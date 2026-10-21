import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowRight,
  ExternalLink,
  GripVertical,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trophy,
  X,
} from 'lucide-react'
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
import { ContactReach } from '@/features/contacts/contact-reach'
import { useMemberNames } from '@/features/members/api'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { BoardColumn, DealView } from './api'
import { dealContactLabel, since } from './deal-format'

const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export interface DealActions {
  open: () => void
  move: (columnId: string) => void
  win: () => void
  lose: () => void
}

/** Conteúdo do card do negócio (também usado no "fantasma" que acompanha o arraste). */
export function DealCardContent({
  deal,
  columns,
  actions,
  handle,
}: {
  deal: DealView
  /** Alça de arraste pelo teclado (só no card do funil). */
  handle?: ReactNode
  columns?: BoardColumn[]
  actions?: DealActions
}) {
  const nameOf = useMemberNames()
  const { conversation } = deal
  const contact = dealContactLabel(deal.contact)

  return (
    <div className="bg-card flex flex-col gap-1.5 rounded-md border p-2.5 text-sm shadow-xs">
      <div className="flex items-start justify-between gap-2">
        {handle}
        <button
          type="button"
          onClick={actions?.open}
          className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
        >
          {deal.title}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {conversation && conversation.unreadCount > 0 && (
            <Badge className="h-5 min-w-5 rounded-full px-1.5" title="Mensagens não lidas">
              {conversation.unreadCount}
            </Badge>
          )}
          {actions && columns && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Ações do negócio ${deal.title}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={actions.open}>
                  <Pencil />
                  Abrir negócio
                </DropdownMenuItem>
                {conversation && (
                  <DropdownMenuItem asChild>
                    <Link to={`/conversations/${conversation.id}?status=${conversation.status}`}>
                      <ExternalLink />
                      Abrir conversa
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={actions.win}>
                  <Trophy />
                  Ganhou
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={actions.lose}>
                  <X />
                  Perdeu…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                {columns
                  .filter((c) => c.id !== deal.columnId)
                  .map((column) => (
                    <DropdownMenuItem key={column.id} onSelect={() => actions.move(column.id)}>
                      <ArrowRight />
                      {column.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Link
          to={`/contacts/${deal.contactId}`}
          className="text-muted-foreground min-w-0 flex-1 truncate hover:underline"
        >
          {deal.title === contact ? 'Ver contato' : contact}
        </Link>
        {/* Atender o lead direto do card: WhatsApp, ligação, e-mail (só o que existir). */}
        {deal.contact && (
          <ContactReach
            compact
            phone={deal.contact.phone}
            email={deal.contact.email}
            name={contact}
            className="-my-1 shrink-0"
          />
        )}
        {deal.valueCents !== null && (
          <span className="shrink-0 font-semibold tabular-nums">
            {formatMoney(deal.valueCents)}
          </span>
        )}
      </div>
      {conversation?.lastMessagePreview && (
        <p className="text-muted-foreground flex items-start gap-1 text-xs">
          <MessageCircle className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2">{conversation.lastMessagePreview}</span>
        </p>
      )}
      <div className="text-muted-foreground flex justify-between gap-2 text-xs">
        <span className={cn('truncate', !deal.ownerId && 'text-warning font-medium')}>
          {deal.ownerId ? (nameOf(deal.ownerId) ?? 'Membro desativado') : 'Sem responsável'}
        </span>
        <span
          className="shrink-0"
          title={`Nesta etapa desde ${fullDate.format(new Date(deal.enteredColumnAt))}`}
        >
          {since(deal.enteredColumnAt)}
        </span>
      </div>
    </div>
  )
}

/**
 * Card arrastável. Mouse e toque: arraste o card por qualquer ponto. Teclado:
 * a alça (botão) pega o card com espaço, as setas movem, espaço solta e Esc
 * cancela. A alça é o único elemento com papel de botão de arraste — o card
 * continua sendo um item de lista com links e menu dentro.
 */
export function SortableDealCard({
  deal,
  columns,
  actions,
}: {
  deal: DealView
  columns: BoardColumn[]
  actions: DealActions
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id })
  const { onKeyDown, ...pointer } = listeners ?? {}

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('touch-manipulation list-none', isDragging && 'opacity-40')}
      aria-label={`Negócio ${deal.title}`}
      {...pointer}
    >
      <DealCardContent
        deal={deal}
        columns={columns}
        actions={actions}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
            aria-label={`Mover negócio ${deal.title}`}
            className="text-muted-foreground hover:bg-accent focus-visible:ring-ring -ml-1 cursor-grab rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  )
}
