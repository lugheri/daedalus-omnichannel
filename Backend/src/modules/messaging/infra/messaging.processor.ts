import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { JobEnvelope } from '../../../shared/infra/queue/job-envelope';
import { TenantAwareProcessor } from '../../../shared/infra/queue/tenant-aware.processor';
import {
  DeliverOutboundJob,
  InboundSmsJob,
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

/** Fila do messaging (worker): entregas e avisos dos provedores. */
@Processor(MESSAGING_QUEUE, { concurrency: 10 })
export class MessagingProcessor extends TenantAwareProcessor {
  constructor(
    deliver: DeliverOutboundMessageUseCase,
    private readonly giveUp: GiveUpOutboundMessageUseCase,
    applyEvents: ApplyProviderEventsUseCase,
    recordInboundSms: RecordInboundSmsUseCase,
  ) {
    super();
    this.on(DeliverOutboundJob, ({ messageId }) => deliver.execute(messageId));
    this.on(ProviderEventsJob, ({ events }) => applyEvents.execute(events));
    this.on(InboundSmsJob, (sms) => recordInboundSms.execute(sms));
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
