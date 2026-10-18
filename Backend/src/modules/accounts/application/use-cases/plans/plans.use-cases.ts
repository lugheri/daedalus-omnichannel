import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { ChildAccountNotFoundError } from '../../../domain/errors/child-account-not-found.error';
import {
  PlanConflictError,
  PlanNotAssignableError,
  PlanNotFoundError,
  PlansRootOnlyError,
} from '../../../domain/errors/plan.errors';
import { Plan, type PlanDetails } from '../../../domain/plan.entity';
import type { Tenant } from '../../../domain/tenant.entity';
import { PLAN_REPOSITORY, type PlanRepository } from '../../ports/plan.repository';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';

/** Planos são mantidos só na conta da plataforma (o catálogo vale para todas). */
@Injectable()
export class PlanKeeper {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository) {}

  async assert(actor: Actor): Promise<void> {
    if (!(await this.tenants.findById(actor.tenantId))?.isRoot) throw new PlansRootOnlyError();
  }
}

export async function loadPlan(plans: PlanRepository, id: string): Promise<Plan> {
  const plan = await plans.findById(id);
  if (!plan) throw new PlanNotFoundError();
  return plan;
}

/**
 * O plano que `giver` (a conta de quem decide) pode dar: a plataforma dá
 * qualquer um não arquivado; o revendedor, os liberados para revenda. O plano
 * que a conta já tem pode ficar (mesmo arquivado).
 */
export function assertAssignable(giver: Tenant, plan: Plan, currentPlanId: string | null): void {
  if (plan.id === currentPlanId) return;
  if (plan.archived || !giver.canCreateChildren || (!giver.isRoot && !plan.resellable)) {
    throw new PlanNotAssignableError();
  }
}

export interface PlanWithUsage {
  plan: Plan;
  accounts: number;
}

@Injectable()
export class ListPlansUseCase {
  constructor(
    private readonly keeper: PlanKeeper,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
  ) {}

  async execute(actor: Actor): Promise<PlanWithUsage[]> {
    await this.keeper.assert(actor);
    const plans = await this.plans.list();
    return Promise.all(
      plans.map(async (plan) => ({ plan, accounts: await this.plans.countAccountsUsing(plan) })),
    );
  }
}

@Injectable()
export class CreatePlanUseCase {
  constructor(
    private readonly keeper: PlanKeeper,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(actor: Actor, details: PlanDetails): Promise<Plan> {
    await this.keeper.assert(actor);
    const plan = Plan.create(this.ids.generate(), details);
    await this.plans.save(plan);
    return plan;
  }
}

/**
 * Editar vale na hora para todas as contas do plano (limites novos barram o
 * que é criado daqui em diante; o que já existe continua). Arquivar tira da
 * escolha; o padrão não se arquiva.
 */
@Injectable()
export class UpdatePlanUseCase {
  constructor(
    private readonly keeper: PlanKeeper,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
  ) {}

  async execute(
    actor: Actor,
    id: string,
    changes: Partial<PlanDetails> & { archived?: boolean },
  ): Promise<Plan> {
    await this.keeper.assert(actor);
    const plan = await loadPlan(this.plans, id);
    const { archived, ...details } = changes;
    plan.update(details);
    if (archived === true) {
      if (plan.isDefault) throw new PlanConflictError('PLAN_IS_DEFAULT');
      plan.archive();
    }
    if (archived === false) plan.unarchive();
    await this.plans.save(plan);
    return plan;
  }
}

/** O plano de quem não tem plano escolhido (cadastros novos e contas sem plano). */
@Injectable()
export class SetDefaultPlanUseCase {
  constructor(
    private readonly keeper: PlanKeeper,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(actor: Actor, id: string): Promise<Plan> {
    await this.keeper.assert(actor);
    return this.unitOfWork.run(async () => {
      const plan = await loadPlan(this.plans, id);
      const current = await this.plans.findDefault();
      if (current && current.id !== plan.id) {
        current.markDefault(false);
        await this.plans.save(current);
      }
      plan.markDefault(true);
      await this.plans.save(plan);
      return plan;
    });
  }
}

/** Só plano sem conta nenhuma (em uso: arquive). */
@Injectable()
export class DeletePlanUseCase {
  constructor(
    private readonly keeper: PlanKeeper,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
  ) {}

  async execute(actor: Actor, id: string): Promise<void> {
    await this.keeper.assert(actor);
    const plan = await loadPlan(this.plans, id);
    if (plan.isDefault) throw new PlanConflictError('PLAN_IS_DEFAULT');
    if ((await this.plans.countAccountsUsing(plan)) > 0) throw new PlanConflictError('PLAN_IN_USE');
    await this.plans.delete(plan);
  }
}

/** Os planos que a conta atual pode dar às contas abaixo dela (vazio se não for revendedora). */
@Injectable()
export class ListAssignablePlansUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async execute(actor: Actor): Promise<Plan[]> {
    const giver = await this.tenants.findById(actor.tenantId);
    if (!giver?.canCreateChildren) return [];
    return (await this.plans.list()).filter(
      (plan) => !plan.archived && (giver.isRoot || plan.resellable),
    );
  }
}

/** Troca o plano de uma conta abaixo da atual (null = o padrão). */
@Injectable()
export class SetChildAccountPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async execute(actor: Actor, childId: string, planId: string | null): Promise<Tenant> {
    const [giver, child] = await Promise.all([
      this.tenants.findById(actor.tenantId),
      this.tenants.findById(childId),
    ]);
    if (!giver || !child?.isBelow(giver.id)) throw new ChildAccountNotFoundError();
    if (planId) assertAssignable(giver, await loadPlan(this.plans, planId), child.planId);
    child.setPlan(planId);
    await this.tenants.save(child);
    return child;
  }
}
