import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { EventBus } from '../../application/event-bus';
import type { DomainEvent } from '../../domain/domain-event';

/**
 * Publica no processo atual. Consumidores se inscrevem com
 * `@OnEvent('contact.created.v1')` em `application/event-handlers/`.
 *
 * TODO(outbox): eventos consumidos por outros módulos passarão pelo outbox
 * (gravado na mesma transação) antes de sair do processo.
 */
@Injectable()
export class InMemoryEventBus implements EventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.emitter.emitAsync(event.eventName, event);
    }
  }
}
