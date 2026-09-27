import { Processor } from '@nestjs/bullmq';
import { TenantAwareProcessor } from '../queue/tenant-aware.processor';
import { DeliverDomainEventJob, DOMAIN_EVENTS_QUEUE } from './domain-event-jobs';
import { DomainEventHandlerRegistry } from './domain-event-handler.registry';

/** Executa a entrega de um evento a um consumidor, no contexto do tenant. */
@Processor(DOMAIN_EVENTS_QUEUE, { concurrency: 10 })
export class DomainEventsProcessor extends TenantAwareProcessor {
  constructor(registry: DomainEventHandlerRegistry) {
    super();
    this.on(DeliverDomainEventJob, (job) => registry.invoke(job.handlerId, job.event));
  }
}
