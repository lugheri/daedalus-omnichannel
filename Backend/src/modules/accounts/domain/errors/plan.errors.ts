import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';

export type InvalidPlanCode = 'PLAN_INVALID_NAME' | 'PLAN_INVALID_LIMIT';

/** Regra do plano violada (422). */
export class InvalidPlanError extends DomainError {
  constructor(readonly code: InvalidPlanCode) {
    super(`Invalid plan: ${code}`);
  }
}

export class PlanNotFoundError extends NotFoundError {
  readonly code = 'PLAN_NOT_FOUND';

  constructor() {
    super('Plan not found');
  }
}

/** Plano em uso não se exclui (arquive); o padrão não se arquiva nem exclui. */
export class PlanConflictError extends ConflictError {
  constructor(readonly code: 'PLAN_IN_USE' | 'PLAN_IS_DEFAULT') {
    super(`Plan conflict: ${code}`);
  }
}

/** Os planos são mantidos só na conta da plataforma. */
export class PlansRootOnlyError extends ForbiddenError {
  readonly code = 'PLANS_ROOT_ONLY';

  constructor() {
    super('Plans are managed by the platform account');
  }
}

/** Plano que esta conta não pode dar (arquivado, ou não liberado para revenda). */
export class PlanNotAssignableError extends ForbiddenError {
  readonly code = 'PLAN_NOT_ASSIGNABLE';

  constructor() {
    super('This plan cannot be assigned by this account');
  }
}
