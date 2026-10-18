import type { PlanFeature, PlanLimit } from '../../../../shared/domain/plan-entitlement';

export interface CurrentPlan {
  id: string | null;
  name: string | null;
  description: string | null;
  /** A conta da plataforma: sem limite. */
  unlimited: boolean;
  limits: Record<PlanLimit, number | null>;
  features: Record<PlanFeature, boolean>;
}

/** O plano e o que a conta atual usa de cada limite, de cada módulo dono (via facades). */
export interface UsageSources {
  plan(): Promise<CurrentPlan>;
  usage(): Promise<Record<PlanLimit, number>>;
}

export const USAGE_SOURCES = Symbol('UsageSources');
