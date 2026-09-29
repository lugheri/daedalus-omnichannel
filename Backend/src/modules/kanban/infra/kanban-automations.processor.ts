import { InjectQueue, Processor } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { JobEnvelope } from '../../../shared/infra/queue/job-envelope';
import { TenantAwareProcessor } from '../../../shared/infra/queue/tenant-aware.processor';
import {
  IdleRuleJob,
  IdleSweepJob,
  IdleSweepUseCase,
  KANBAN_AUTOMATIONS_QUEUE,
  RunIdleRuleUseCase,
} from '../application/automations/idle-automations';

/** Jobs das automações de tempo parado (worker). */
@Processor(KANBAN_AUTOMATIONS_QUEUE, { concurrency: 5 })
export class KanbanAutomationsProcessor extends TenantAwareProcessor {
  constructor(sweep: IdleSweepUseCase, runIdleRule: RunIdleRuleUseCase) {
    super();
    this.on(IdleSweepJob, () => sweep.execute());
    this.on(IdleRuleJob, ({ ruleId }) => runIdleRule.execute(ruleId));
  }
}

const EVERY_MS = 60_000;

/**
 * Agenda a varredura a cada minuto. O agendador do BullMQ é único por nome
 * no Redis: com várias réplicas do worker, a varredura continua rodando uma
 * vez por minuto (e registrar de novo na subida só atualiza).
 */
@Injectable()
export class KanbanAutomationsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(KanbanAutomationsScheduler.name);

  constructor(@InjectQueue(KANBAN_AUTOMATIONS_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    const data: JobEnvelope<Record<string, never>> = { v: 1, payload: {}, meta: {} };
    await this.queue.upsertJobScheduler(
      'kanban-idle-sweep',
      { every: EVERY_MS },
      {
        name: IdleSweepJob.name,
        data,
        opts: { removeOnComplete: { count: 100 }, removeOnFail: { age: 24 * 3600 } },
      },
    );
    this.logger.log(`Varredura das automações de tempo parado a cada ${EVERY_MS / 1000}s`);
  }
}
