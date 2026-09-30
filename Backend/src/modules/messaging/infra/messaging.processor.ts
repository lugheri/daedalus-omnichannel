import { InjectQueue, OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import type { JobEnvelope } from '../../../shared/infra/queue/job-envelope';
import { TenantAwareProcessor } from '../../../shared/infra/queue/tenant-aware.processor';
import {
  CampaignSweepJob,
  DeliverOutboundJob,
  InboundSmsJob,
  MaterializeCampaignJob,
  MESSAGING_QUEUE,
  ProviderEventsJob,
} from '../application/messaging-jobs';
import {
  DeliverOutboundMessageUseCase,
  GiveUpOutboundMessageUseCase,
} from '../application/use-cases/deliver-outbound.use-cases';
import {
  ApplyProviderEventsUseCase,
  RecordInboundSmsUseCase,
} from '../application/use-cases/provider-webhooks.use-cases';
import {
  MaterializeCampaignUseCase,
  StartDueCampaignsUseCase,
} from '../application/use-cases/campaign-sending.use-cases';

/** Fila do messaging (worker): entregas e avisos dos provedores. */
@Processor(MESSAGING_QUEUE, { concurrency: 10 })
export class MessagingProcessor extends TenantAwareProcessor {
  constructor(
    deliver: DeliverOutboundMessageUseCase,
    private readonly giveUp: GiveUpOutboundMessageUseCase,
    applyEvents: ApplyProviderEventsUseCase,
    recordInboundSms: RecordInboundSmsUseCase,
    materialize: MaterializeCampaignUseCase,
    startDue: StartDueCampaignsUseCase,
  ) {
    super();
    this.on(DeliverOutboundJob, ({ messageId }) => deliver.execute(messageId));
    this.on(ProviderEventsJob, ({ events }) => applyEvents.execute(events));
    this.on(InboundSmsJob, (sms) => recordInboundSms.execute(sms));
    this.on(MaterializeCampaignJob, ({ campaignId }) => materialize.execute(campaignId));
    this.on(CampaignSweepJob, () => startDue.execute());
  }

  /** Entrega que esgotou as tentativas: a mensagem vira "falhou" (senão ficaria na fila para sempre). */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobEnvelope<{ messageId?: string }>> | undefined): Promise<void> {
    if (!job || job.name !== DeliverOutboundJob.name) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const messageId = job.data.payload.messageId;
    if (!messageId) return;
    await this.inJobContext(job, () => this.giveUp.execute(messageId));
  }
}

const SWEEP_EVERY_MS = 60_000;

/**
 * Agenda a varredura das campanhas a cada minuto. O agendador do BullMQ é
 * único por nome no Redis: com várias réplicas do worker, roda uma vez só.
 */
@Injectable()
export class MessagingScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(MessagingScheduler.name);

  constructor(@InjectQueue(MESSAGING_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    const data: JobEnvelope<Record<string, never>> = { v: 1, payload: {}, meta: {} };
    await this.queue.upsertJobScheduler(
      'messaging-campaign-sweep',
      { every: SWEEP_EVERY_MS },
      {
        name: CampaignSweepJob.name,
        data,
        opts: { removeOnComplete: { count: 100 }, removeOnFail: { age: 24 * 3600 } },
      },
    );
    this.logger.log(`Varredura de campanhas agendadas a cada ${SWEEP_EVERY_MS / 1000}s`);
  }
}
