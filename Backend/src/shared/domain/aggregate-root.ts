import { DomainEvent } from './domain-event';
import { Entity } from './entity';

/**
 * Raiz de agregado: registra eventos de domínio, mas não os publica.
 * O use case salva o agregado e então publica o que `pullEvents()` devolver.
 */
export abstract class AggregateRoot<Props extends object> extends Entity<Props> {
  private events: DomainEvent[] = [];

  protected addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  /** Já há evento registrado nesta operação (para não repetir avisos genéricos)? */
  protected get hasPendingEvents(): boolean {
    return this.events.length > 0;
  }

  pullEvents(): DomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}
