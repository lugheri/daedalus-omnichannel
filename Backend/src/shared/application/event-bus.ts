import type { DomainEvent } from '../domain/domain-event';

/**
 * Em memória no MVP; RabbitMQ/NATS quando um módulo for extraído.
 * Quem publica e quem consome não sabem qual implementação está em uso.
 */
export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
}

export const EVENT_BUS = Symbol('EventBus');
