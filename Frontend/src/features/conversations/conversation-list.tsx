import { Inbox, WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRealtimeStatus } from '@/features/realtime/realtime-context'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMemberNames } from '@/features/members/api'
import { useConversations, type AssigneeFilter, type ConversationStatus } from './api'
import { contactInitials, contactLabel, listTime } from './format'

const TABS: { value: ConversationStatus; label: string }[] = [
  { value: 'open', label: 'Abertas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'resolved', label: 'Resolvidas' },
]

const EMPTY: Record<ConversationStatus, string> = {
  open: 'Nenhuma conversa aberta. As mensagens novas aparecem aqui.',
  pending: 'Nenhuma conversa aguardando o cliente.',
  resolved: 'Nenhuma conversa resolvida.',
}

/** Coluna da esquerda: conversas do status escolhido, mais recentes primeiro. */
export function ConversationList({
  status,
  assignee,
  selectedId,
  linkTo,
  onStatusChange,
  onAssigneeChange,
}: {
  status: ConversationStatus
  assignee: AssigneeFilter
  selectedId: string | undefined
  linkTo: (conversationId: string) => string
  onStatusChange: (status: ConversationStatus) => void
  onAssigneeChange: (assignee: AssigneeFilter) => void
}) {
  const conversations = useConversations(status, assignee)
  const nameOf = useMemberNames()
  const realtime = useRealtimeStatus()
  const items = conversations.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {realtime === 'reconnecting' && (
        <p
          role="status"
          className="bg-muted text-muted-foreground flex items-center gap-2 px-3 py-1.5 text-xs"
        >
          <WifiOff className="size-3.5" />
          Reconectando… a lista se atualiza a cada poucos segundos.
        </p>
      )}
      <div className="border-b p-3">
        <Tabs value={status} onValueChange={(value) => onStatusChange(value as ConversationStatus)}>
          <TabsList className="w-full">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={assignee} onValueChange={(v) => onAssigneeChange(v as AssigneeFilter)}>
          <SelectTrigger size="sm" className="mt-2 w-full" aria-label="Filtrar por responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas que eu vejo</SelectItem>
            <SelectItem value="me">Minhas</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <nav aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto">
        {conversations.isPending &&
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="m-3 h-14" />)}

        {!conversations.isPending && items.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-12 text-center text-sm">
            <Inbox className="size-8" />
            {EMPTY[status]}
          </div>
        )}

        {items.map((conversation) => {
          const selected = conversation.id === selectedId
          const unread = conversation.unreadCount > 0
          return (
            <Link
              key={conversation.id}
              to={linkTo(conversation.id)}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'hover:bg-accent flex gap-3 border-b px-3 py-3',
                selected && 'bg-accent',
              )}
            >
              <Avatar className="size-10">
                <AvatarFallback>{contactInitials(conversation.contact)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('truncate', unread && 'font-semibold')}>
                    {contactLabel(conversation.contact)}
                  </span>
                  <span
                    className={cn(
                      'text-muted-foreground shrink-0 text-xs',
                      unread && 'text-primary font-medium',
                    )}
                  >
                    {listTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate text-sm">
                    {conversation.lastMessagePreview ?? '—'}
                  </span>
                  {unread && (
                    <Badge className="h-5 min-w-5 rounded-full px-1.5">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
                <span className="text-muted-foreground block truncate text-xs">
                  {[
                    conversation.channel.name ?? 'Canal removido',
                    conversation.team?.name,
                    nameOf(conversation.assigneeId) ?? 'Sem responsável',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </Link>
          )
        })}

        {conversations.hasNextPage && (
          <div className="flex justify-center p-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={conversations.isFetchingNextPage}
              onClick={() => void conversations.fetchNextPage()}
            >
              {conversations.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
            </Button>
          </div>
        )}
      </nav>
    </div>
  )
}
