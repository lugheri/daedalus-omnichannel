import type { Actor, ActorContext } from '../application/actor-context';
import type { EventBus } from '../application/event-bus';
import type { IdGenerator } from '../application/id-generator';
import type { EnqueueOptions, JobDefinition, JobQueue } from '../application/job-queue';
import type { RealtimeNotifier } from '../application/realtime';
import { TenantNotResolvedError, type TenantContext } from '../application/tenant-context';
import type { UnitOfWork } from '../application/unit-of-work';
import type { DomainEvent } from '../domain/domain-event';

/**
 * Implementações falsas dos ports do shared kernel, para testes unitários.
 * Pastas `testing/` ficam fora do build de produção.
 */

/** Gera ids previsíveis: `id-1`, `id-2`... */
export class SequentialIdGenerator implements IdGenerator {
  private next = 1;

  generate(): string {
    return `id-${this.next++}`;
  }
}

/** Guarda os jobs enfileirados para o teste inspecionar. */
export class RecordingJobQueue implements JobQueue {
  readonly jobs: { queue: string; name: string; payload: unknown; options?: EnqueueOptions }[] = [];

  add<T>(job: JobDefinition<T>, payload: T, options?: EnqueueOptions): Promise<void> {
    this.jobs.push({ queue: job.queue, name: job.name, payload, options });
    return Promise.resolve();
  }

  /** Payloads enfileirados de um tipo de job. */
  of<T>(job: JobDefinition<T>): T[] {
    return this.jobs
      .filter((j) => j.queue === job.queue && j.name === job.name)
      .map((j) => j.payload as T);
  }
}

/** Guarda os eventos publicados para o teste inspecionar. */
export class RecordingEventBus implements EventBus {
  readonly published: DomainEvent[] = [];

  publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
    return Promise.resolve();
  }
}

/**
 * Executa o trabalho sem transação real e conta as execuções — o teste
 * verifica que o use case usou a unidade de trabalho. (Rollback de verdade
 * só existe contra o banco: é assunto de teste e2e.)
 */
export class ImmediateUnitOfWork implements UnitOfWork {
  runs = 0;

  run<T>(work: () => Promise<T>): Promise<T> {
    this.runs++;
    return work();
  }
}

/** Guarda o ator autenticado em memória, como o contexto da requisição faria. */
export class InMemoryActorContext implements ActorContext {
  private current: Actor | null = null;

  get actor(): Actor {
    if (!this.current) throw new TenantNotResolvedError();
    return this.current;
  }

  authenticate(actor: Actor): void {
    this.current = actor;
  }
}

/** Tenant fixo e trocável — `switchTo` simula uma requisição de outro tenant. */
export class FakeTenantContext implements TenantContext {
  constructor(private current: string | null = 'tenant-a') {}

  get tenantId(): string {
    if (!this.current) throw new TenantNotResolvedError();
    return this.current;
  }

  switchTo(tenantId: string | null): void {
    this.current = tenantId;
  }
}

/** Guarda os avisos em tempo real emitidos, com as salas de destino. */
export class RecordingRealtimeNotifier implements RealtimeNotifier {
  readonly emitted: { rooms: string[]; event: string; data: Record<string, unknown> }[] = [];

  emit(rooms: readonly string[], event: string, data: Record<string, unknown>): Promise<void> {
    this.emitted.push({ rooms: [...rooms].sort(), event, data });
    return Promise.resolve();
  }
}
