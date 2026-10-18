import { Controller, Get } from '@nestjs/common';
import { GetPlanUsageUseCase } from '../application/get-plan-usage.use-case';

/** Qualquer membro vê o plano da conta e o uso (sem permissão específica, como o /v1/me). */
@Controller('v1/plan')
export class PlanUsageController {
  constructor(private readonly getUsage: GetPlanUsageUseCase) {}

  @Get()
  get() {
    return this.getUsage.execute();
  }
}
