import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useRealtimeLive } from '@/features/realtime/realtime-context'
import { api } from '@/lib/api/client'

export type ConversationStatus = 'open' | 'pending' | 'resolved'

export interface Conversation {
  id: string
  status: ConversationStatus
  assigneeId: string | null
  unreadCount: number
  lastMessageAt: string
  lastMessagePreview: string | null
  createdAt: string
  contact: { id: string; name: string | null; phone: string | null }
  /** null = fila geral. */
  team: { id: string; name: string } | null
  /** `name` null = canal removido (a conversa fica como histórico). */
  channel: { id: string; name: string | null }
}

/** Recorte da lista: todas (no meu escopo), só as minhas, ou só as sem responsável. */
export type AssigneeFilter = 'all' | 'me' | 'none'

export type MessageStatus = 'received' | 'pending' | 'sent' | 'failed'

export interface Message {
  id: string
  conversationId: string
  direction: 'inbound' | 'outbound'
  kind: string
  text: string | null
  status: MessageStatus
  error: string | null
  senderMembershipId: string | null
  sentAt: string
}

interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export const conversationsApi = {
  list: (status: ConversationStatus, assignee: AssigneeFilter, cursor?: string) =>
    api<Page<Conversation>>('/v1/conversations', {
      query: { status, assignee: assignee === 'all' ? undefined : assignee, limit: 30, cursor },
    }),
  get: (id: string) => api<Conversation>(`/v1/conversations/${id}`),
  messages: (id: string, cursor?: string) =>
    api<Page<Message>>(`/v1/conversations/${id}/messages`, { query: { limit: 50, cursor } }),
  send: (id: string, text: string) =>
    api<Message>(`/v1/conversations/${id}/messages`, { method: 'POST', body: { text } }),
  changeStatus: (id: string, status: ConversationStatus) =>
    api<void>(`/v1/conversations/${id}/status`, { method: 'POST', body: { status } }),
  claim: (id: string) => api<void>(`/v1/conversations/${id}/claim`, { method: 'POST' }),
  /** Campo ausente = não muda; null = fila geral / sem responsável. */
  transfer: (id: string, input: { teamId?: string | null; assigneeId?: string | null }) =>
    api<void>(`/v1/conversations/${id}/transfer`, { method: 'POST', body: input }),
  markRead: (id: string) => api<void>(`/v1/conversations/${id}/read`, { method: 'POST' }),
}

export const conversationKeys = {
  all: ['conversations'] as const,
  list: (status: ConversationStatus, assignee: AssigneeFilter) =>
    ['conversations', 'list', status, assignee] as const,
  detail: (id: string) => ['conversations', 'detail', id] as const,
  messages: (id: string) => ['conversations', 'messages', id] as const,
}

/*
 * Com o tempo real conectado, os avisos do servidor invalidam estas query
 * keys (RealtimeProvider) e não há polling. Se a conexão cair, as telas
 * voltam a se atualizar sozinhas nestes intervalos até ela voltar.
 */
const LIST_REFRESH_MS = 5_000
const CHAT_REFRESH_MS = 3_000

export function useConversations(status: ConversationStatus, assignee: AssigneeFilter) {
  const live = useRealtimeLive()
  return useInfiniteQuery({
    queryKey: conversationKeys.list(status, assignee),
    queryFn: ({ pageParam }) => conversationsApi.list(status, assignee, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: live ? false : LIST_REFRESH_MS,
  })
}

export function useConversation(id: string) {
  const live = useRealtimeLive()
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () => conversationsApi.get(id),
    refetchInterval: live ? false : CHAT_REFRESH_MS,
  })
}

/** Páginas da mais recente para a mais antiga; a tela inverte para exibir. */
export function useMessages(id: string) {
  const live = useRealtimeLive()
  return useInfiniteQuery({
    queryKey: conversationKeys.messages(id),
    queryFn: ({ pageParam }) => conversationsApi.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: live ? false : CHAT_REFRESH_MS,
  })
}
