import { useMe } from '@/features/auth/session-context'
import type { PlanFeature } from './api'

/** O plano da conta inclui o recurso? (Só para a tela; a API confere de novo.) */
export function usePlanFeature(feature: PlanFeature): boolean {
  return useMe().plan?.features[feature] ?? true
}

/** Dica para o botão desligado por falta do recurso no plano. */
export const NOT_IN_PLAN = 'Não incluso no plano da conta (veja em Configurações › Meu plano)'
