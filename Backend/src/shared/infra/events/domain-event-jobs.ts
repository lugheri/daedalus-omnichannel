import { defineJob } from '../../application/job-queue';

export const DOMAIN_EVENTS_QUEUE = 'domain-events';

/** Entrega de UM evento a UM consumidor (isolamento de falhas e de retry). */
export const DeliverDomainEventJob = defineJob<{
  eventId: string;
  eventName: string;
  handlerId: string;
  event: Record<string, unknown>;
}>(DOMAIN_EVENTS_QUEUE, 'deliver');
