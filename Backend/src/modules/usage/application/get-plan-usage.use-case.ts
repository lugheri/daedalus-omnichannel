import { Inject, Injectable } from '@nestjs/common';
import type { PlanLimit } from '../../../shared/domain/plan-entitlement';
import { USAGE_SOURCES, type CurrentPlan, type UsageSources } from './ports/usage-sources';

/** O plano da conta atual e o uso de cada limite (a tela "Meu plano"). */
@Injectable()
export class GetPlanUsageUseCase {
  constructor(@Inject(USAGE_SOURCES) private readonly sources: UsageSources) {}

  async execute(): Promise<{ plan: CurrentPlan; usage: Record<PlanLimit, number> }> {
    const [plan, usage] = await Promise.all([this.sources.plan(), this.sources.usage()]);
    return { plan, usage };
  }
}
