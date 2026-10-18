import type { PlanFeature, PlanLimit } from '../domain/plan-entitlement';

/**
 * Os limites do plano da conta atual (ADR 0015), para qualquer módulo:
 * cada um conta o que é seu e pergunta se cabe mais um. A conta da
 * plataforma não tem limite. Regra: só o que é NOVO é barrado — o que já
 * existe continua funcionando mesmo acima do limite (plano rebaixado).
 *
 * Implementado pelo módulo accounts (dono dos planos); token exportado pelo
 * `AccountsModule`.
 */
export interface PlanEntitlements {
  /** Lança `PlanLimitReachedError` se `used` (o que já existe) já ocupa o limite. */
  ensureRoom(limit: PlanLimit, used: number): Promise<void>;
  /** Lança `PlanFeatureUnavailableError` se o plano não inclui o recurso. */
  ensureFeature(feature: PlanFeature): Promise<void>;
}

export const PLAN_ENTITLEMENTS = Symbol('PlanEntitlements');
