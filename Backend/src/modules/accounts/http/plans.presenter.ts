import { PLAN_FEATURES, PLAN_LIMITS } from '../../../shared/domain/plan-entitlement';
import type { AccountPlan } from '../application/tenant-entitlements';
import type { Plan } from '../domain/plan.entity';

export const presentPlan = (plan: Plan) => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  limits: plan.limits,
  features: plan.features,
  resellable: plan.resellable,
  isDefault: plan.isDefault,
  archived: plan.archived,
  updatedAt: plan.updatedAt.toISOString(),
});

/** O plano de uma conta: `unlimited` (a plataforma) = sem limite e com tudo. */
export function presentAccountPlan({ plan, unlimited }: AccountPlan) {
  const all = Object.fromEntries(PLAN_FEATURES.map((f) => [f, true]));
  const none = Object.fromEntries(PLAN_LIMITS.map((l) => [l, null]));
  return {
    id: plan?.id ?? null,
    name: unlimited ? null : (plan?.name ?? null),
    unlimited,
    limits: unlimited || !plan ? none : plan.limits,
    features: unlimited || !plan ? all : plan.features,
  };
}
