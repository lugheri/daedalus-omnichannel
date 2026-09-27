import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { CLS_ID, ClsService } from 'nestjs-cls';
import { JOB_QUEUE, type JobQueue } from '../../application/job-queue';
import type { AppClsStore } from '../context/app-cls-store';
import { DeliverDomainEventJob } from './domain-event-jobs';
import { DomainEventHandlerRegistry } from './domain-event-handler.registry';
import { OUTBOX_STORE, type OutboxRecord, type OutboxStore } from './outbox-store';

const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 100;

/**
 * Roda no worker: a cada segundo, pega eventos pendentes do outbox e cria um
 * job de entrega por consumidor. Garantia "ao menos uma vez": se cair entre
 * enfileirar e marcar como publicado, o lote é reenfileirado — o id estável
 * do job (`<evento>:<consumidor>`) evita duplicatas na maior parte dos casos,
 * e os consumidores são idempotentes para o resto.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(OUTBOX_STORE) private readonly store: OutboxStore,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    private readonly registry: DomainEventHandlerRegistry,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Um ciclo: drena o outbox em lotes até esvaziar. Público para testes. */
  async tick(): Promise<void> {
    if (this.running) return; // o ciclo anterior ainda não terminou
    this.running = true;
    try {
      while ((await this.store.claim(BATCH_SIZE, (records) => this.deliver(records))) > 0) {
        // continua enquanto houver lote cheio de pendências
      }
    } catch (error) {
      this.logger.error(`Falha ao processar o outbox: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(records: OutboxRecord[]): Promise<void> {
    for (const record of records) {
      for (const handlerId of this.registry.handlersFor(record.eventName)) {
        // Enfileira no contexto do evento original: o job herda tenant e
        // correlation id, e os logs do consumidor ficam ligados à origem.
        await this.cls.run(() => {
          this.cls.set(CLS_ID, record.correlationId ?? `event:${record.id}`);
          if (record.tenantId) this.cls.set('tenantId', record.tenantId);
          return this.queue.add(
            DeliverDomainEventJob,
            {
              eventId: record.id,
              eventName: record.eventName,
              handlerId,
              event: { ...record.payload, eventId: record.id },
            },
            { jobId: `${record.id}:${handlerId}`, attempts: 8 },
          );
        });
      }
    }
  }
}
