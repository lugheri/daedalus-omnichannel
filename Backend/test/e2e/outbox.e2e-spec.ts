import { getQueueToken } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { CLS_ID, ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { AppConfigModule } from '../../src/config/app-config.module';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../src/shared/application/domain-event-handler';
import { EVENT_BUS, type EventBus } from '../../src/shared/application/event-bus';
import { TENANT_CONTEXT, type TenantContext } from '../../src/shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../src/shared/application/unit-of-work';
import { DomainEvent } from '../../src/shared/domain/domain-event';
import type { AppClsStore } from '../../src/shared/infra/context/app-cls-store';
import { DOMAIN_EVENTS_QUEUE } from '../../src/shared/infra/events/domain-event-jobs';
import { OutboxWorkerModule } from '../../src/shared/infra/events/outbox-worker.module';
import { PrismaModule } from '../../src/shared/infra/prisma/prisma.module';
import { PrismaService } from '../../src/shared/infra/prisma/prisma.service';
import { SharedInfraModule } from '../../src/shared/infra/shared-infra.module';

class ProbeEvent extends DomainEvent {
  static readonly eventName = 'e2e.probe.v1';
  readonly eventName = ProbeEvent.eventName;

  constructor(
    aggregateId: string,
    readonly tenantId: string,
    readonly note: string,
  ) {
    super(aggregateId);
  }
}

/** Consumidor de teste: registra o que recebeu e em qual contexto. */
@Injectable()
class ProbeHandler {
  readonly received: {
    event: DeliveredEvent<ProbeEvent>;
    tenantId: string;
    correlationId: string;
  }[] = [];

  constructor(
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  @HandlesDomainEvent(ProbeEvent)
  handle(event: DeliveredEvent<ProbeEvent>) {
    this.received.push({ event, tenantId: this.tenant.tenantId, correlationId: this.cls.getId() });
    return Promise.resolve();
  }
}

async function waitFor(condition: () => boolean, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timeout esperando a condição');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('Outbox → fila → consumidor (Postgres e Redis reais)', () => {
  let app: TestingModule;
  let probe: ProbeHandler;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, SharedInfraModule, OutboxWorkerModule],
      providers: [ProbeHandler],
    }).compile();
    await app.init();
    probe = app.get(ProbeHandler);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { eventName: ProbeEvent.eventName } });
    await app.get<Queue>(getQueueToken(DOMAIN_EVENTS_QUEUE)).obliterate({ force: true });
    await app.close();
  });

  /** Publica como um use case faria: dentro de uma unidade de trabalho, num contexto de tenant. */
  function publishInTenant(tenantId: string, correlationId: string, work: () => Promise<void>) {
    const cls = app.get<ClsService<AppClsStore>>(ClsService);
    return cls.run(() => {
      cls.set(CLS_ID, correlationId);
      cls.set('tenantId', tenantId);
      return app.get<UnitOfWork>(UNIT_OF_WORK).run(work);
    });
  }

  it('delivers the event to the handler in the tenant and correlation context of the origin', async () => {
    const tenantId = randomUUID();
    const aggregateId = randomUUID();

    await publishInTenant(tenantId, 'corr-e2e-1', () =>
      app.get<EventBus>(EVENT_BUS).publish([new ProbeEvent(aggregateId, tenantId, 'olá')]),
    );

    await waitFor(() => probe.received.some((r) => r.event.aggregateId === aggregateId));
    const delivery = probe.received.find((r) => r.event.aggregateId === aggregateId)!;
    expect(delivery.event.note).toBe('olá');
    expect(delivery.event.eventId).toEqual(expect.any(String));
    expect(delivery.tenantId).toBe(tenantId);
    expect(delivery.correlationId).toBe('corr-e2e-1');

    const row = await prisma.outboxEvent.findFirst({ where: { aggregateId } });
    expect(row?.publishedAt).not.toBeNull();
  });

  it('publishes nothing when the transaction rolls back', async () => {
    const tenantId = randomUUID();
    const aggregateId = randomUUID();

    await expect(
      publishInTenant(tenantId, 'corr-e2e-2', async () => {
        await app.get<EventBus>(EVENT_BUS).publish([new ProbeEvent(aggregateId, tenantId, 'x')]);
        throw new Error('regra de negócio falhou depois de publicar');
      }),
    ).rejects.toThrow('regra de negócio');

    expect(await prisma.outboxEvent.count({ where: { aggregateId } })).toBe(0);
  });
});
