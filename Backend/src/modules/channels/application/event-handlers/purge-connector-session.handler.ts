import { Inject, Injectable } from '@nestjs/common';
import { PurgeWhatsAppSession } from '../../../../contracts/whatsapp-connector.contract';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { ChannelRemovedEvent } from '../../domain/events/channel-events';

/**
 * Canal removido → o conector apaga a sessão guardada (credenciais do
 * WhatsApp). Idempotente: o jobId estável descarta repetições, e apagar o
 * que já não existe não tem efeito.
 */
@Injectable()
export class PurgeConnectorSessionHandler {
  constructor(@Inject(JOB_QUEUE) private readonly jobs: JobQueue) {}

  @HandlesDomainEvent(ChannelRemovedEvent)
  async handle(event: DeliveredEvent<ChannelRemovedEvent>): Promise<void> {
    await this.jobs.add(
      PurgeWhatsAppSession,
      { channelId: event.aggregateId },
      { jobId: `purge:${event.aggregateId}` },
    );
  }
}
