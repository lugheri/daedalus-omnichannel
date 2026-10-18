import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

/** Espelho de `shared/domain/plan-entitlement.ts` do backend. */
export const PLAN_LIMITS = [
  'members',
  'whatsappChannels',
  'webChatChannels',
  'forms',
  'landingPages',
  'childAccounts',
] as const
export type PlanLimit = (typeof PLAN_LIMITS)[number]

export const PLAN_FEATURES = ['campaigns', 'automations', 'onlineBooking', 'abTesting'] as const
export type PlanFeature = (typeof PLAN_FEATURES)[number]

/** null = sem limite. */
export type PlanLimits = Record<PlanLimit, number | null>
export type PlanFeatures = Record<PlanFeature, boolean>

export interface Plan {
  id: string
  name: string
  description: string | null
  limits: PlanLimits
  features: PlanFeatures
  /** Revendedores podem dar este plano às contas abaixo deles. */
  resellable: boolean
  /** O plano de quem não tem plano escolhido. */
  isDefault: boolean
  /** Fora da escolha; quem já usa continua. */
  archived: boolean
  updatedAt: string
  /** Só na lista da plataforma: quantas contas estão nele. */
  accounts?: number
}

export type PlanInput = Pick<Plan, 'name' | 'description' | 'limits' | 'features' | 'resellable'>

export interface PlanUsage {
  plan: {
    id: string | null
    name: string | null
    description: string | null
    /** A conta da plataforma: sem limite. */
    unlimited: boolean
    limits: PlanLimits
    features: PlanFeatures
  }
  usage: Record<PlanLimit, number>
}

export const plansApi = {
  list: () => api<Plan[]>('/v1/plans'),
  create: (input: PlanInput) => api<Plan>('/v1/plans', { method: 'POST', body: input }),
  update: (id: string, input: Partial<PlanInput> & { archived?: boolean }) =>
    api<Plan>(`/v1/plans/${id}`, { method: 'PATCH', body: input }),
  setDefault: (id: string) => api<Plan>(`/v1/plans/${id}/default`, { method: 'POST' }),
  remove: (id: string) => api<void>(`/v1/plans/${id}`, { method: 'DELETE' }),
  /** Os que a conta atual pode dar às contas abaixo dela. */
  assignable: () => api<Plan[]>('/v1/plans/assignable'),
  /** O plano da conta atual e o uso de cada limite. */
  usage: () => api<PlanUsage>('/v1/plan'),
}

export const planKeys = {
  all: ['plans'] as const,
  list: ['plans', 'list'] as const,
  assignable: ['plans', 'assignable'] as const,
  usage: ['plans', 'usage'] as const,
}

export function usePlans() {
  return useQuery({ queryKey: planKeys.list, queryFn: plansApi.list })
}

export function useAssignablePlans(enabled = true) {
  return useQuery({ queryKey: planKeys.assignable, queryFn: plansApi.assignable, enabled })
}

export function usePlanUsage() {
  return useQuery({ queryKey: planKeys.usage, queryFn: plansApi.usage })
}

export const LIMIT_LABELS: Record<PlanLimit, { label: string; hint?: string }> = {
  members: { label: 'Membros', hint: 'Quem tem login, contando os convites pendentes.' },
  whatsappChannels: { label: 'Números de WhatsApp' },
  webChatChannels: { label: 'Chats do site' },
  forms: { label: 'Formulários' },
  landingPages: { label: 'Landing pages' },
  childAccounts: { label: 'Contas clientes', hint: 'Só para revendedores: contas abaixo dela.' },
}

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  campaigns: 'Campanhas de e-mail e SMS',
  automations: 'Automações do funil',
  onlineBooking: 'Agendamento online pelo site',
  abTesting: 'Teste A/B nas landing pages',
}

/** "5" ou "Sem limite". */
export function formatLimit(value: number | null): string {
  return value === null ? 'Sem limite' : String(value)
}
