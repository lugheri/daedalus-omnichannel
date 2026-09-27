import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import type { EnqueueOptions, JobDefinition, JobQueue } from '../../application/job-queue';
import type { AppClsStore } from '../context/app-cls-store';
import type { DomainEventHandlerRegistry } from './domain-event-handler.registry';
import { OutboxRelay } from './outbox-relay';
import type { OutboxRecord, OutboxStore } from './outbox-store';

class FakeOutboxStore implements OutboxStore {
  published: string[] = [];
  constructor(public pending: OutboxRecord[]) {}

  async claim(limit: number, deliver: (records: OutboxRecord[]) => Promise<void>) {
    const batch = this.pending.slice(0, limit);
    if (batch.length === 0) return 0;
    await deliver(batch); // se lançar, nada é marcado como publicado
    this.pending = this.pending.slice(batch.length);
    this.published.push(...batch.map((r) => r.id));
    return batch.length;
  }
}

/** Guarda os jobs e o tenant/correlation id do contexto no momento do enqueue. */
class RecordingQueue implements JobQueue {
  jobs: {
    name: string;
    payload: unknown;
    options?: EnqueueOptions;
    tenantId?: string;
    correlationId?: string;
  }[] = [];
  failOnce = false;

  constructor(private readonly cls: ClsService<AppClsStore>) {}

  add<T>(job: JobDefinition<T>, payload: T, options?: EnqueueOptions): Promise<void> {
    if (this.failOnce) {
      this.failOnce = false;
      return Promise.reject(new Error('redis down'));
    }
    this.jobs.push({
      name: job.name,
      payload,
      options,
      tenantId: this.cls.get('tenantId'),
      correlationId: this.cls.getId(),
    });
    return Promise.resolve();
  }
}

const HANDLERS: Record<string, string[]> = {
  'contact.created.v1': ['CrmSync.handle', 'Audit.handle'],
};
const registry = {
  handlersFor: (name: string) => HANDLERS[name] ?? [],
} as unknown as DomainEventHandlerRegistry;

const record = (id: string, eventName = 'contact.created.v1'): OutboxRecord => ({
  id,
  eventName,
  tenantId: 'tenant-1',
  correlationId: 'req-123',
  payload: { aggregateId: 'contact-1' },
});

describe('OutboxRelay', () => {
  let cls: ClsService<AppClsStore>;
  let queue: RecordingQueue;

  beforeEach(() => {
    cls = new ClsService(new AsyncLocalStorage());
    queue = new RecordingQueue(cls);
  });

  it('creates one delivery job per handler, with a stable id', async () => {
    const store = new FakeOutboxStore([record('evt-1')]);

    await new OutboxRelay(store, queue, registry, cls).tick();

    expect(queue.jobs.map((j) => j.options?.jobId)).toEqual([
      'evt-1:CrmSync.handle',
      'evt-1:Audit.handle',
    ]);
    expect(store.published).toEqual(['evt-1']);
  });

  it('delivers in the context of the original operation (tenant and correlation id)', async () => {
    await new OutboxRelay(new FakeOutboxStore([record('evt-1')]), queue, registry, cls).tick();

    expect(queue.jobs[0]).toMatchObject({ tenantId: 'tenant-1', correlationId: 'req-123' });
  });

  it('marks events nobody listens to as published', async () => {
    const store = new FakeOutboxStore([record('evt-1', 'nobody.cares.v1')]);

    await new OutboxRelay(store, queue, registry, cls).tick();

    expect(queue.jobs).toHaveLength(0);
    expect(store.published).toEqual(['evt-1']);
  });

  it('keeps events pending when enqueueing fails, and delivers them on the next tick', async () => {
    const store = new FakeOutboxStore([record('evt-1')]);
    const relay = new OutboxRelay(store, queue, registry, cls);
    queue.failOnce = true;

    await relay.tick();
    expect(store.published).toEqual([]);

    await relay.tick();
    expect(store.published).toEqual(['evt-1']);
  });
});
