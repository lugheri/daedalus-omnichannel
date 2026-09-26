import type { EventBus } from '../application/event-bus';
import type { IdGenerator } from '../application/id-generator';
import { TenantNotResolvedError, type TenantContext } from '../application/tenant-context';
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
