import { MessagesSquare } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { cn } from '@/lib/utils'
import type { AssigneeFilter, ConversationStatus } from './api'
import { ConversationChat } from './conversation-chat'
import { ConversationList } from './conversation-list'

const STATUSES: ConversationStatus[] = ['open', 'pending', 'resolved']
const FILTERS: AssigneeFilter[] = ['all', 'me', 'none']

/**
 * Caixa de entrada: lista à esquerda, conversa à direita. A conversa aberta,
 * a aba e o filtro ficam na URL (`/conversations/:id?status=open&assignee=me`)
 * — dá para recarregar ou compartilhar o link. No celular, uma coluna por vez.
 */
export function InboxPage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const status = pick(search.get('status'), STATUSES, 'open')
  const assignee = pick(search.get('assignee'), FILTERS, 'all')

  const urlFor = (next: {
    id?: string
    status?: ConversationStatus
    assignee?: AssigneeFilter
  }) => {
    const params = new URLSearchParams({ status: next.status ?? status })
    const filter = next.assignee ?? assignee
    if (filter !== 'all') params.set('assignee', filter)
    const path = next.id === undefined ? (id ?? '') : next.id
    return `/conversations${path ? `/${path}` : ''}?${params}`
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={cn(
          'flex min-h-0 w-full flex-col border-r md:w-80 lg:w-96',
          id && 'hidden md:flex',
        )}
      >
        <ConversationList
          status={status}
          assignee={assignee}
          selectedId={id}
          linkTo={(conversationId) => urlFor({ id: conversationId })}
          onStatusChange={(next) => navigate(urlFor({ status: next }))}
          onAssigneeChange={(next) => navigate(urlFor({ assignee: next }))}
        />
      </aside>

      <section className={cn('min-h-0 min-w-0 flex-1 flex-col', id ? 'flex' : 'hidden md:flex')}>
        {id ? (
          // key: trocar de conversa zera o rascunho e o estado do chat.
          <ConversationChat key={id} id={id} backTo={urlFor({ id: '' })} />
        ) : (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-sm">
            <MessagesSquare className="size-10" />
            Selecione uma conversa
          </div>
        )}
      </section>
    </div>
  )
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}
