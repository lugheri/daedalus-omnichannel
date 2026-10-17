import { useQuery } from '@tanstack/react-query'
import type { ConversationStatus } from '@/features/conversations/api'
import { api } from '@/lib/api/client'

export type AutoAdd = { mode: 'none' } | { mode: 'all' } | { mode: 'team'; teamId: string }

/** Etapa do funil. */
export interface BoardColumn {
  id: string
  name: string
}

/** Funil de vendas (o "quadro"). */
export interface Board {
  id: string
  name: string
  /** Etapas, na ordem de exibição. */
  columns: BoardColumn[]
  /** Conversas novas entram na primeira etapa. */
  autoAdd: AutoAdd
  /** Leads do formulário do site entram na primeira etapa. */
  autoAddLeads: boolean
  createdAt: string
}

/** A conversa do negócio (só vem se o membro a vê). */
export interface DealConversation {
  id: string
  status: ConversationStatus
  assigneeId: string | null
  dispositionId: string | null
  unreadCount: number
  lastMessageAt: string
  lastMessagePreview: string | null
  contact: { id: string; name: string | null; phone: string | null }
  channel: { id: string; name: string | null }
  team: { id: string; name: string } | null
}

export interface DealContact {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}

export type DealStatus = 'open' | 'won' | 'lost'

export interface Deal {
  id: string
  boardId: string
  columnId: string
  contactId: string
  conversationId: string | null
  title: string
  /** Centavos; null = sem valor. */
  valueCents: number | null
  /** Responsável (membership); null = ninguém (fila de leads). */
  ownerId: string | null
  status: DealStatus
  lostReason: string | null
  closedAt: string | null
  /** Desde quando está na etapa atual. */
  enteredColumnAt: string
  createdAt: string
}

/** O negócio como as telas o mostram. */
export interface DealView extends Deal {
  contact: DealContact | null
  conversation: DealConversation | null
}

/** Negócio com o funil e a etapa (ficha do contato, chat, detalhe). */
export interface PlacedDeal extends DealView {
  board: { id: string; name: string }
  column: { id: string; name: string }
}

export interface ColumnPage {
  columnId: string
  deals: DealView[]
  nextCursor: string | null
}

export interface CreateDealInput {
  boardId: string
  columnId?: string
  contactId?: string
  conversationId?: string
  title?: string
  valueCents?: number | null
  /** Ausente = quem cria; null = ninguém. */
  ownerId?: string | null
}

export const boardsApi = {
  list: () => api<Board[]>('/v1/boards'),
  get: (id: string) => api<Board>(`/v1/boards/${id}`),
  create: (input: { name: string; columns?: string[] }) =>
    api<Board>('/v1/boards', { method: 'POST', body: input }),
  update: (id: string, input: { name?: string; autoAdd?: AutoAdd; autoAddLeads?: boolean }) =>
    api<Board>(`/v1/boards/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`/v1/boards/${id}`, { method: 'DELETE' }),
  addColumn: (id: string, name: string) =>
    api<Board>(`/v1/boards/${id}/columns`, { method: 'POST', body: { name } }),
  updateColumn: (id: string, columnId: string, input: { name?: string; index?: number }) =>
    api<Board>(`/v1/boards/${id}/columns/${columnId}`, { method: 'PATCH', body: input }),
  /** Etapa com negócios precisa de `moveTo` (para onde eles vão). */
  removeColumn: (id: string, columnId: string, moveTo?: string) =>
    api<Board>(`/v1/boards/${id}/columns/${columnId}`, {
      method: 'DELETE',
      query: { moveTo },
    }),
  /** Negócios em aberto: primeira página de todas as etapas, ou mais uma página de uma etapa. */
  deals: (id: string, page?: { columnId: string; cursor: string }) =>
    api<ColumnPage[]>(`/v1/boards/${id}/deals`, { query: { limit: 50, ...page } }),
}

export const dealsApi = {
  create: (input: CreateDealInput) => api<Deal>('/v1/deals', { method: 'POST', body: input }),
  get: (id: string) => api<PlacedDeal>(`/v1/deals/${id}`),
  /** Campo ausente = não muda; `valueCents`/`ownerId` null = tira. */
  update: (
    id: string,
    input: {
      title?: string
      valueCents?: number | null
      ownerId?: string | null
      conversationId?: string
    },
  ) => api<Deal>(`/v1/deals/${id}`, { method: 'PATCH', body: input }),
  /** `afterDealId`: o negócio que fica logo acima no destino (null = topo). */
  move: (id: string, columnId: string, afterDealId: string | null) =>
    api<Deal>(`/v1/deals/${id}/move`, { method: 'POST', body: { columnId, afterDealId } }),
  setStatus: (id: string, input: { status: DealStatus; lostReason?: string | null }) =>
    api<Deal>(`/v1/deals/${id}/status`, { method: 'POST', body: input }),
  remove: (id: string) => api<void>(`/v1/deals/${id}`, { method: 'DELETE' }),
  /** Todos os negócios do contato (abertos primeiro). */
  byContact: (contactId: string) => api<PlacedDeal[]>('/v1/deals', { query: { contactId } }),
  /** Negócios em aberto da conversa. */
  byConversation: (conversationId: string) =>
    api<PlacedDeal[]>('/v1/deals', { query: { conversationId } }),
}

export const boardKeys = {
  all: ['boards'] as const,
  list: ['boards', 'list'] as const,
  detail: (id: string) => ['boards', 'detail', id] as const,
  deals: (id: string) => ['boards', 'deals', id] as const,
  allDeals: ['boards', 'deals'] as const,
}

/** Negócios fora do funil (ficha do contato, chat, detalhe). */
export const dealKeys = {
  all: ['deals'] as const,
  detail: (id: string) => ['deals', 'detail', id] as const,
  contact: (contactId: string) => ['deals', 'contact', contactId] as const,
  conversation: (conversationId: string) => ['deals', 'conversation', conversationId] as const,
}

export function useBoards() {
  return useQuery({ queryKey: boardKeys.list, queryFn: boardsApi.list })
}

export function useBoard(id: string) {
  return useQuery({ queryKey: boardKeys.detail(id), queryFn: () => boardsApi.get(id) })
}

/** Negócios por etapa. O tempo real (board.changed / conversation.changed) mantém atualizado. */
export function useBoardDeals(id: string) {
  return useQuery({ queryKey: boardKeys.deals(id), queryFn: () => boardsApi.deals(id) })
}

export function useDeal(id: string | null) {
  return useQuery({
    queryKey: dealKeys.detail(id ?? ''),
    queryFn: () => dealsApi.get(id!),
    enabled: Boolean(id),
  })
}

export function useContactDeals(contactId: string) {
  return useQuery({
    queryKey: dealKeys.contact(contactId),
    queryFn: () => dealsApi.byContact(contactId),
  })
}

export function useConversationDeals(conversationId: string) {
  return useQuery({
    queryKey: dealKeys.conversation(conversationId),
    queryFn: () => dealsApi.byConversation(conversationId),
  })
}
