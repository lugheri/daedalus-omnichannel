import { MessagesSquare } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { cn } from '@/lib/utils'
import type { ConversationStatus } from './api'
import { ConversationChat } from './conversation-chat'
import { ConversationList } from './conversation-list'

const STATUSES: ConversationStatus[] = ['open', 'pending', 'resolved']

/**
 * Caixa de entrada: lista à esquerda, conversa à direita. A conversa aberta e
 * a aba ficam na URL (`/conversations/:id?status=open`) — dá para recarregar
 * ou compartilhar o link. No celular, uma coluna por vez.
 */
export function InboxPage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const requested = search.get('status') as ConversationStatus | null
  const status = requested && STATUSES.includes(requested) ? requested : 'open'
  const listUrl = `/conversations?status=${status}`

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
          selectedId={id}
          onStatusChange={(next) =>
            navigate(id ? `/conversations/${id}?status=${next}` : `/conversations?status=${next}`)
          }
        />
      </aside>

      <section className={cn('min-h-0 min-w-0 flex-1 flex-col', id ? 'flex' : 'hidden md:flex')}>
        {id ? (
          // key: trocar de conversa zera o rascunho e o estado do chat.
          <ConversationChat key={id} id={id} backTo={listUrl} />
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
