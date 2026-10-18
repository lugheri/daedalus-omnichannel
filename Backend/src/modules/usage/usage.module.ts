import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { ChannelsModule } from '../channels';
import { FormsModule } from '../forms';
import { SitesModule } from '../sites';
import { GetPlanUsageUseCase } from './application/get-plan-usage.use-case';
import { USAGE_SOURCES } from './application/ports/usage-sources';
import { PlanUsageController } from './http/plan-usage.controller';
import { FacadeUsageSources } from './infra/facade-usage-sources';

/**
 * O plano da conta e o uso de cada limite (ADR 0015), só na API. Junta o que
 * cada módulo dono conta (pelas facades) — o accounts, dono dos planos, não
 * depende dos outros módulos.
 */
@Module({
  imports: [AccountsModule, ChannelsModule, FormsModule, SitesModule],
  controllers: [PlanUsageController],
  providers: [GetPlanUsageUseCase, { provide: USAGE_SOURCES, useClass: FacadeUsageSources }],
})
export class UsageModule {}
