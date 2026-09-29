import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

/** Espelho dos gatilhos do backend (kanban/domain/automation-rule.entity.ts). */
export type AutomationTrigger =
  | { type: 'card_entered' }
  | { type: 'card_idle'; minutes: number }
  | { type: 'disposition_set'; dispositionId: string }
  | { type: 'conversation_resolved' }
  | { type: 'customer_replied' }

export type TriggerType = AutomationTrigger['type']

/** Gatilhos que movem o card PARA a coluna da regra (sem ações próprias). */
export const MOVE_INTO_TRIGGERS: TriggerType[] = [
  'disposition_set',
  'conversation_resolved',
  'customer_replied',
]

export type AutomationAction =
  | { type: 'send_message'; text: string }
  /** Campo ausente = não muda; null = tira (fila geral / sem responsável). */
  | { type: 'assign'; teamId?: string | null; assigneeId?: string | null }
  | { type: 'move'; columnId: string }

export interface Automation {
  id: string
  boardId: string
  columnId: string
  trigger: AutomationTrigger
  actions: AutomationAction[]
  enabled: boolean
  activeSince: string
  createdAt: string
}

export interface AutomationRun {
  id: string
  cardId: string
  conversationId: string
  status: 'running' | 'succeeded' | 'failed'
  /** `error` também traz o motivo de uma ação pulada (ok: true). */
  results: { type: AutomationAction['type']; ok: boolean; error?: string }[]
  createdAt: string
  finishedAt: string | null
}

export interface AutomationInput {
  trigger: AutomationTrigger
  actions: AutomationAction[]
  enabled?: boolean
}

export const automationsApi = {
  list: (boardId: string) => api<Automation[]>(`/v1/boards/${boardId}/automations`),
  create: (boardId: string, input: AutomationInput & { columnId: string }) =>
    api<Automation>(`/v1/boards/${boardId}/automations`, { method: 'POST', body: input }),
  update: (boardId: string, id: string, input: Partial<AutomationInput>) =>
    api<Automation>(`/v1/boards/${boardId}/automations/${id}`, { method: 'PATCH', body: input }),
  remove: (boardId: string, id: string) =>
    api<void>(`/v1/boards/${boardId}/automations/${id}`, { method: 'DELETE' }),
  runs: (boardId: string, id: string) =>
    api<AutomationRun[]>(`/v1/boards/${boardId}/automations/${id}/runs`),
}

export const automationKeys = {
  list: (boardId: string) => ['boards', 'automations', boardId] as const,
  runs: (ruleId: string) => ['boards', 'automation-runs', ruleId] as const,
}

/** Só quem gerencia quadros vê as automações (`enabled`). */
export function useAutomations(boardId: string, enabled: boolean) {
  return useQuery({
    queryKey: automationKeys.list(boardId),
    queryFn: () => automationsApi.list(boardId),
    enabled,
  })
}

export function useAutomationRuns(boardId: string, ruleId: string, enabled: boolean) {
  return useQuery({
    queryKey: automationKeys.runs(ruleId),
    queryFn: () => automationsApi.runs(boardId, ruleId),
    enabled,
  })
}
