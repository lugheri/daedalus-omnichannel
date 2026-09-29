import { MessagesSquare } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { CONVERSATION_SCOPES } from '@/app/navigation'
import { useContactConversations, type ConversationStatus } from '@/features/conversations/api'
import { useMemberNames } from '@/features/members/api'

const STATUS: Record<ConversationStatus, string> = {
  open: 'Aberta',
  pending: 'Pendente',
  resolved: 'Resolvida',
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Atendimentos do contato, em todos os canais. A API devolve só as conversas
 * que o membro pode ver — um atendente vê aqui o mesmo que na caixa de entrada.
 */
export function ContactHistory({ contactId }: { contactId: string }) {
  const { canAny } = usePermissions()
  const allowed = canAny(...CONVERSATION_SCOPES)
  const conversations = useContactConversations(contactId, allowed)
  const nameOf = useMemberNames()
  const items = conversations.data?.items ?? []

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="font-semibold">
        Histórico de atendimentos
      </h2>
      {!allowed && (
        <p className="text-muted-foreground text-sm">Seu cargo não dá acesso às conversas.</p>
      )}
      {allowed && conversations.isPending && <Skeleton className="h-16" />}
      {allowed && !conversations.isPending && items.length === 0 && (
        <p className="text-muted-foreground text-sm">Nenhum atendimento que você possa ver.</p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((conversation) => (
          <li key={conversation.id}>
            <Link
              to={`/conversations/${conversation.id}?status=${conversation.status}`}
              className="hover:bg-accent flex gap-3 rounded-md border p-3"
            >
              <MessagesSquare className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {conversation.channel.name ?? 'Canal removido'}
                    {conversation.team && ` · ${conversation.team.name}`}
                  </span>
                  <Badge variant="outline">{STATUS[conversation.status]}</Badge>
                </div>
                <p className="text-muted-foreground truncate text-sm">
                  {conversation.lastMessagePreview ?? '—'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {dateTime.format(new Date(conversation.lastMessageAt))} ·{' '}
                  {nameOf(conversation.assigneeId) ?? 'Sem responsável'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
