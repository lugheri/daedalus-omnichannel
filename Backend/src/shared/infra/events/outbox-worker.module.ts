import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DOMAIN_EVENTS_QUEUE } from './domain-event-jobs';
import { DomainEventHandlerRegistry } from './domain-event-handler.registry';
import { DomainEventsProcessor } from './domain-events.processor';
import { OutboxRelay } from './outbox-relay';
import { OUTBOX_STORE } from './outbox-store';
import { PrismaOutboxStore } from './prisma-outbox.store';

/**
 * Entrega de eventos de domínio — só no processo `worker`: o relay lê o
 * outbox e o processor executa os consumidores.
 */
@Module({
  imports: [DiscoveryModule, BullModule.registerQueue({ name: DOMAIN_EVENTS_QUEUE })],
  providers: [
    DomainEventHandlerRegistry,
    OutboxRelay,
    DomainEventsProcessor,
    { provide: OUTBOX_STORE, useClass: PrismaOutboxStore },
  ],
})
export class OutboxWorkerModule {}
