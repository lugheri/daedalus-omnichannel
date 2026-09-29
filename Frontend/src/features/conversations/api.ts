import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useRealtimeLive } from '@/features/realtime/realtime-context'
import { api, apiBlob } from '@/lib/api/client'

export type ConversationStatus = 'open' | 'pending' | 'resolved'

export interface Conversation {
  id: string
  status: ConversationStatus
  assigneeId: string | null
  /** Tabulação do atendimento atual; null ao reabrir uma resolvida. */
  dispositionId: string | null
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
  /** Enviada por uma automação do kanban (sem remetente). */
  automated: boolean
  sentAt: string
  /** Anexo (o arquivo sai por GET .../messages/:id/media). */
  media: { mimeType: string; size: number; fileName: string | null } | null
}

/** Um registro do histórico de tabulações de uma conversa. */
export interface ConversationDisposition {
  id: string
  conversationId: string
  dispositionId: string
  note: string | null
  membershipId: string
  createdAt: string
}

export interface TabulationInput {
  dispositionId: string
  note?: string
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
  /** Histórico de um contato: todas as conversas dele (qualquer status) no meu escopo. */
  byContact: (contactId: string) =>
    api<Page<Conversation>>('/v1/conversations', { query: { contactId, limit: 50 } }),
  get: (id: string) => api<Conversation>(`/v1/conversations/${id}`),
  messages: (id: string, cursor?: string) =>
    api<Page<Message>>(`/v1/conversations/${id}/messages`, { query: { limit: 50, cursor } }),
  send: (id: string, text: string) =>
    api<Message>(`/v1/conversations/${id}/messages`, { method: 'POST', body: { text } }),
  /** Ao resolver, a tabulação pode ir junto (obrigatória se a conta tem tabulações). */
  changeStatus: (id: string, status: ConversationStatus, disposition?: TabulationInput) =>
    api<void>(`/v1/conversations/${id}/status`, {
      method: 'POST',
      body: { status, disposition },
    }),
  tabulate: (id: string, input: TabulationInput) =>
    api<ConversationDisposition>(`/v1/conversations/${id}/dispositions`, {
      method: 'POST',
      body: input,
    }),
  dispositions: (id: string) =>
    api<ConversationDisposition[]>(`/v1/conversations/${id}/dispositions`),
  /** Anexo: legenda ANTES do arquivo (o backend lê os campos que vêm antes do file). */
  sendAttachment: (id: string, file: File, caption: string) => {
    const form = new FormData()
    if (caption.trim()) form.append('caption', caption.trim())
    form.append('file', file)
    return api<Message>(`/v1/conversations/${id}/attachments`, { method: 'POST', body: form })
  },
  media: (conversationId: string, messageId: string) =>
    apiBlob(`/v1/conversations/${conversationId}/messages/${messageId}/media`),
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
  byContact: (contactId: string) => ['conversations', 'contact', contactId] as const,
  messages: (id: string) => ['conversations', 'messages', id] as const,
  dispositions: (id: string) => ['conversations', 'dispositions', id] as const,
}

/** Histórico de tabulações (mais recentes primeiro). */
export function useConversationDispositions(id: string, enabled = true) {
  return useQuery({
    queryKey: conversationKeys.dispositions(id),
    queryFn: () => conversationsApi.dispositions(id),
    enabled,
  })
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

export function useContactConversations(contactId: string, enabled: boolean) {
  return useQuery({
    queryKey: conversationKeys.byContact(contactId),
    queryFn: () => conversationsApi.byContact(contactId),
    enabled,
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

/**
 * Arquivo de uma mensagem, baixado com o token (um <img src> não mandaria o
 * Authorization). Fica no cache: reabrir a conversa não baixa de novo.
 */
export function useMessageMedia(conversationId: string, messageId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['conversations', 'media', messageId],
    queryFn: () => conversationsApi.media(conversationId, messageId),
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
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
