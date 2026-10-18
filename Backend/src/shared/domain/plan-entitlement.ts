import { ForbiddenError } from './domain-error';

/**
 * Catálogo do que um plano limita (ADR 0015). Fixo no código, como as
 * permissões: só tem efeito se algum módulo verificar. Os valores (quantos,
 * se tem) ficam no plano de cada conta; a plataforma edita os planos.
 */
export const PLAN_LIMITS = [
  'members',
  'whatsappChannels',
  'webChatChannels',
  'forms',
  'landingPages',
  'childAccounts',
] as const;
export type PlanLimit = (typeof PLAN_LIMITS)[number];

export const PLAN_FEATURES = ['campaigns', 'automations', 'onlineBooking', 'abTesting'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

const upper = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();

/** O plano da conta não comporta mais um (403 `PLAN_LIMIT_<LIMITE>`, ex.: `PLAN_LIMIT_MEMBERS`). */
export class PlanLimitReachedError extends ForbiddenError {
  readonly code: string;

  constructor(
    readonly limit: PlanLimit,
    readonly max: number,
  ) {
    super(`Plan limit reached: ${limit} (${max})`);
    this.code = `PLAN_LIMIT_${upper(limit)}`;
  }
}

/** O plano da conta não inclui o recurso (403 `PLAN_FEATURE_<RECURSO>`). */
export class PlanFeatureUnavailableError extends ForbiddenError {
  readonly code: string;

  constructor(readonly feature: PlanFeature) {
    super(`Not in the plan: ${feature}`);
    this.code = `PLAN_FEATURE_${upper(feature)}`;
  }
}
