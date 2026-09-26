import type { EventBus } from '../application/event-bus';
import type { IdGenerator } from '../application/id-generator';
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
