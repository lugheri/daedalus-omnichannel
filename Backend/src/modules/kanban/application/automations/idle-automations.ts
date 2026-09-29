import { Inject, Injectable } from '@nestjs/common';
import { defineJob, JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import {
  AUTOMATION_RULE_REPOSITORY,
  type AutomationRuleRepository,
} from '../ports/automation-rule.repository';
import {
  AUTOMATION_RUN_REPOSITORY,
  idleDedupeKey,
  type AutomationRunRepository,
} from '../ports/automation-run.repository';
import { AutomationRunner } from './automation-runner';

export const KANBAN_AUTOMATIONS_QUEUE = 'kanban-automations';

/** A cada minuto (agendado no worker): distribui as regras de tempo parado. */
export const IdleSweepJob = defineJob<Record<string, never>>(
  KANBAN_AUTOMATIONS_QUEUE,
  'idle-sweep',
);

/** Uma regra de tempo parado, no tenant dela. */
export const IdleRuleJob = defineJob<{ ruleId: string }>(KANBAN_AUTOMATIONS_QUEUE, 'idle-rule');

/** Cards por regra a cada rodada (o resto fica para o próximo minuto). */
const BATCH = 100;

/**
 * Varre as regras ativas de todas as contas e enfileira um job por regra,
 * já no tenant dela — cada conta roda isolada, e uma falha não trava as
 * outras. O id do job por minuto evita rodadas duplicadas da mesma regra.
 */
@Injectable()
export class IdleSweepUseCase {
  constructor(
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(now = new Date()): Promise<number> {
    const minute = Math.floor(now.getTime() / 60_000);
    const rules = await this.rules.listEnabledIdleAllTenants();
    for (const rule of rules) {
      this.tenant.enter(rule.tenantId);
      await this.jobs.add(
        IdleRuleJob,
        { ruleId: rule.id },
        { jobId: `idle-rule:${rule.id}:${minute}`, attempts: 3 },
      );
    }
    return rules.length;
  }
}

/** Dispara a regra para os cards que passaram do tempo na coluna. */
@Injectable()
export class RunIdleRuleUseCase {
  constructor(
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
    @Inject(AUTOMATION_RUN_REPOSITORY) private readonly runs: AutomationRunRepository,
    private readonly runner: AutomationRunner,
  ) {}

  async execute(ruleId: string, now = new Date()): Promise<void> {
    const rule = await this.rules.findById(ruleId);
    if (!rule?.enabled || rule.trigger.type !== 'card_idle') return;
    for (const card of await this.runs.dueIdleCards(rule, now, BATCH)) {
      await this.runner.run(rule, card, idleDedupeKey(card));
    }
  }
}
