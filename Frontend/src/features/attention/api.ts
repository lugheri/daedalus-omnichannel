import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '@/features/auth/session-context'
import { boardsApi, type ColumnPage } from '@/features/boards/api'
import type { Conversation } from '@/features/conversations/api'
import { api } from '@/lib/api/client'

/**
 * Contadores do que pede ação, para o menu (e o título da aba): conversas
 * esperando resposta e negócios sem responsável (a fila de leads).
 *
 * Não existe rota de contagem no backend: as contas saem das listas que já
 * existem, com o maior `limit` que elas aceitam (100). É uma aproximação —
 * ver os comentários de cada contagem.
 *
 * Atualização: a cada minuto, ao voltar o foco da aba e pelos avisos de tempo
 * real que já existem — as query keys ficam embaixo de prefixos que o
 * `RealtimeProvider` e o `refreshDeals` já invalidam:
 * - `['conversations', 'list', …]`: `conversation.changed` e reconexão;
 * - `['deals', …]` (`dealKeys.all`): `board.changed` e toda mudança de negócio feita na tela.
 */
export const attentionKeys = {
  conversations: ['conversations', 'list', 'attention'] as const,
  deals: ['deals', 'attention'] as const,
}

const REFRESH_MS = 60_000
const PAGE_LIMIT = 100

// Mesma lista do menu (app/navigation.ts), repetida para a feature não depender de app/.
const CONVERSATION_SCOPES = [
  'conversations:view:own',
  'conversations:view:team',
  'conversations:view:all',
]

/**
 * Conversas esperando resposta: abertas ("precisa de atenção do atendimento")
 * com mensagem do cliente ainda não lida. Responder pelo sistema zera o
 * `unreadCount`; abrir a conversa também (marca como lida), mesmo sem
 * responder. Conta só as 100 abertas mais recentes no escopo do membro.
 */
async function countWaitingConversations(): Promise<number> {
  const page = await api<{ items: Conversation[] }>('/v1/conversations', {
    query: { status: 'open', limit: PAGE_LIMIT },
  })
  return page.items.filter((conversation) => conversation.unreadCount > 0).length
}

/**
 * Negócios em aberto sem responsável (a "fila de leads", onde caem os leads do
 * formulário). Uma chamada por funil, com a primeira página (até 100) de cada
 * etapa — a API já filtra pelo que o membro vê.
 */
async function countUnownedDeals(): Promise<number> {
  const boards = await boardsApi.list()
  const pages = await Promise.all(
    boards.map((board) =>
      api<ColumnPage[]>(`/v1/boards/${board.id}/deals`, { query: { limit: PAGE_LIMIT } }),
    ),
  )
  return pages
    .flat()
    .reduce((sum, column) => sum + column.deals.filter((d) => !d.ownerId).length, 0)
}

const live = {
  refetchInterval: REFRESH_MS,
  // Voltar para a aba depois de um tempo fora: atualiza já, sem esperar o minuto.
  refetchOnWindowFocus: 'always',
  // Em segundo plano o intervalo continua (o título da aba mostra o número).
  refetchIntervalInBackground: true,
  staleTime: 10_000,
} as const

/** Contagem por tela do menu (`to` do item) e o total. */
export function useAttentionCounts(): { byPath: Record<string, number>; total: number } {
  const { canAny } = usePermissions()
  const enabled = canAny(...CONVERSATION_SCOPES)

  const conversations = useQuery({
    queryKey: attentionKeys.conversations,
    queryFn: countWaitingConversations,
    enabled,
    ...live,
  })
  const deals = useQuery({
    queryKey: attentionKeys.deals,
    queryFn: countUnownedDeals,
    enabled,
    ...live,
  })

  const byPath: Record<string, number> = {}
  if (enabled && conversations.data) byPath['/conversations'] = conversations.data
  if (enabled && deals.data) byPath['/boards'] = deals.data
  const total = Object.values(byPath).reduce((sum, n) => sum + n, 0)
  return { byPath, total }
}

/** Texto do contador para leitor de tela e dica ("3 conversas esperando resposta"). */
export function attentionLabel(path: string | null, count: number): string {
  const many = count !== 1
  if (path === '/conversations') {
    return `${count} ${many ? 'conversas esperando' : 'conversa esperando'} resposta`
  }
  if (path === '/boards') {
    return `${count} ${many ? 'negócios' : 'negócio'} sem responsável`
  }
  return `${count} ${many ? 'itens pedem' : 'item pede'} atenção`
}
