import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { EventBus } from '../../application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../application/id-generator';
import type { DomainEvent } from '../../domain/domain-event';
import type { AppClsStore } from '../context/app-cls-store';
import type { Prisma } from '../prisma/generated/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * EventBus com outbox: publicar = gravar o evento no banco, na MESMA
 * transação dos dados (quando o use case usa UnitOfWork). Se o processo cair
 * logo depois do commit, o evento continua lá e será entregue pelo relay do
 * worker; se a transação falhar, o evento some junto com os dados.
 */
@Injectable()
export class OutboxEventBus implements EventBus {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    private readonly cls: ClsService<AppClsStore>,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    const contextTenant = this.cls.isActive()
      ? (this.cls.get('actor')?.tenantId ?? this.cls.get('tenantId'))
      : undefined;
    const correlationId = this.cls.isActive() ? this.cls.getId() : undefined;

    await this.txHost.tx.outboxEvent.createMany({
      data: events.map((event) => ({
        id: this.ids.generate(),
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        tenantId: tenantOf(event) ?? contextTenant ?? null,
        payload: toJson(event),
        correlationId: correlationId ?? null,
        occurredAt: event.occurredAt,
      })),
    });
  }
}

/** Eventos de módulos multi-tenant carregam `tenantId`; o do evento prevalece. */
function tenantOf(event: DomainEvent): string | undefined {
  const tenantId = (event as DomainEvent & { tenantId?: unknown }).tenantId;
  return typeof tenantId === 'string' ? tenantId : undefined;
}

/** Só os dados do evento (Date vira string ISO). */
function toJson(event: DomainEvent): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;
}
