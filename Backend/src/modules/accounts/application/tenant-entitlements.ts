import { Inject, Injectable } from '@nestjs/common';
import {
  PLAN_ENTITLEMENTS,
  type PlanEntitlements,
} from '../../../shared/application/plan-entitlements';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import {
  PlanFeatureUnavailableError,
  PlanLimitReachedError,
  type PlanFeature,
  type PlanLimit,
} from '../../../shared/domain/plan-entitlement';
import type { Plan } from '../domain/plan.entity';
import { PLAN_REPOSITORY, type PlanRepository } from './ports/plan.repository';
import { TENANT_REPOSITORY, type TenantRepository } from './ports/tenant.repository';

export interface AccountPlan {
  /** null só se não houver plano nenhum no catálogo (aí, sem limite). */
  plan: Plan | null;
  /** A conta da plataforma não tem limite. */
  unlimited: boolean;
}

/**
 * O plano de uma conta e as checagens do plano (ADR 0015). É a
 * implementação de `PLAN_ENTITLEMENTS` para os outros módulos (conta atual)
 * e é usada aqui dentro com o tenant explícito (convites, contas filhas).
 */
@Injectable()
export class TenantEntitlements implements PlanEntitlements {
  constructor(
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
  ) {}

  async of(tenantId: string): Promise<AccountPlan> {
    const tenant = await this.tenants.findById(tenantId);
    if (!tenant || tenant.isRoot) return { plan: null, unlimited: true };
    const chosen = tenant.planId ? await this.plans.findById(tenant.planId) : null;
    const plan = chosen ?? (await this.plans.findDefault());
    return { plan, unlimited: plan === null };
  }

  async roomFor(tenantId: string, limit: PlanLimit, used: number): Promise<void> {
    const { plan, unlimited } = await this.of(tenantId);
    const max = unlimited || !plan ? null : plan.limitOf(limit);
    if (max !== null && used >= max) throw new PlanLimitReachedError(limit, max);
  }

  async featureFor(tenantId: string, feature: PlanFeature): Promise<void> {
    const { plan, unlimited } = await this.of(tenantId);
    if (!unlimited && plan && !plan.has(feature)) throw new PlanFeatureUnavailableError(feature);
  }

  ensureRoom(limit: PlanLimit, used: number): Promise<void> {
    return this.roomFor(this.tenant.tenantId, limit, used);
  }

  ensureFeature(feature: PlanFeature): Promise<void> {
    return this.featureFor(this.tenant.tenantId, feature);
  }
}

/** O token compartilhado (PLAN_ENTITLEMENTS) servido por esta classe, para o AccountsModule exportar. */
export const PLAN_ENTITLEMENTS_PROVIDER = {
  provide: PLAN_ENTITLEMENTS,
  useExisting: TenantEntitlements,
};
