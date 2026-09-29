import { useQuery } from '@tanstack/react-query'
import type { ConversationStatus } from '@/features/conversations/api'
import { api } from '@/lib/api/client'

export type AutoAdd = { mode: 'none' } | { mode: 'all' } | { mode: 'team'; teamId: string }

export interface BoardColumn {
  id: string
  name: string
}

export interface Board {
  id: string
  name: string
  /** Na ordem de exibição. */
  columns: BoardColumn[]
  autoAdd: AutoAdd
  createdAt: string
}

/** A conversa do card (só as que o membro vê chegam aqui). */
export interface CardConversation {
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

export interface BoardCard {
  id: string
  boardId: string
  columnId: string
  conversationId: string
  /** Desde quando está na coluna atual. */
  enteredColumnAt: string
  createdAt: string
  conversation: CardConversation
}

export interface ColumnPage {
  columnId: string
  cards: BoardCard[]
  nextCursor: string | null
}

export interface Placement {
  cardId: string
  board: { id: string; name: string }
  column: { id: string; name: string }
  enteredColumnAt: string
}

export const boardsApi = {
  list: () => api<Board[]>('/v1/boards'),
  get: (id: string) => api<Board>(`/v1/boards/${id}`),
  create: (input: { name: string; columns?: string[] }) =>
    api<Board>('/v1/boards', { method: 'POST', body: input }),
  update: (id: string, input: { name?: string; autoAdd?: AutoAdd }) =>
    api<Board>(`/v1/boards/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`/v1/boards/${id}`, { method: 'DELETE' }),
  addColumn: (id: string, name: string) =>
    api<Board>(`/v1/boards/${id}/columns`, { method: 'POST', body: { name } }),
  updateColumn: (id: string, columnId: string, input: { name?: string; index?: number }) =>
    api<Board>(`/v1/boards/${id}/columns/${columnId}`, { method: 'PATCH', body: input }),
  /** Coluna com cards precisa de `moveTo` (para onde eles vão). */
  removeColumn: (id: string, columnId: string, moveTo?: string) =>
    api<Board>(`/v1/boards/${id}/columns/${columnId}`, {
      method: 'DELETE',
      query: { moveTo },
    }),
  /** Primeira página de todas as colunas, ou mais uma página de uma coluna. */
  cards: (id: string, page?: { columnId: string; cursor: string }) =>
    api<ColumnPage[]>(`/v1/boards/${id}/cards`, { query: { limit: 50, ...page } }),
  addCard: (id: string, conversationId: string, columnId?: string) =>
    api<BoardCard>(`/v1/boards/${id}/cards`, {
      method: 'POST',
      body: { conversationId, columnId },
    }),
  /** `afterCardId`: o card que fica logo acima no destino (null = topo). */
  moveCard: (id: string, cardId: string, columnId: string, afterCardId: string | null) =>
    api<BoardCard>(`/v1/boards/${id}/cards/${cardId}/move`, {
      method: 'POST',
      body: { columnId, afterCardId },
    }),
  removeCard: (id: string, cardId: string) =>
    api<void>(`/v1/boards/${id}/cards/${cardId}`, { method: 'DELETE' }),
  placements: (conversationId: string) =>
    api<Placement[]>('/v1/boards/placements', { query: { conversationId } }),
}

export const boardKeys = {
  all: ['boards'] as const,
  list: ['boards', 'list'] as const,
  detail: (id: string) => ['boards', 'detail', id] as const,
  cards: (id: string) => ['boards', 'cards', id] as const,
  allCards: ['boards', 'cards'] as const,
  placements: (conversationId: string) => ['boards', 'placements', conversationId] as const,
}

export function useBoards() {
  return useQuery({ queryKey: boardKeys.list, queryFn: boardsApi.list })
}

export function useBoard(id: string) {
  return useQuery({ queryKey: boardKeys.detail(id), queryFn: () => boardsApi.get(id) })
}

/** Cards por coluna. O tempo real (board.changed / conversation.changed) mantém atualizado. */
export function useBoardCards(id: string) {
  return useQuery({ queryKey: boardKeys.cards(id), queryFn: () => boardsApi.cards(id) })
}

export function usePlacements(conversationId: string) {
  return useQuery({
    queryKey: boardKeys.placements(conversationId),
    queryFn: () => boardsApi.placements(conversationId),
  })
}
