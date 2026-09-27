import { SetMetadata } from '@nestjs/common';

export const DOMAIN_EVENT_HANDLER = 'shared:domain-event-handler';

/**
 * Marca um método como consumidor de um evento de domínio (de qualquer
 * módulo). Roda no `worker`, com o tenant do evento no contexto e retry
 * automático — por isso o handler precisa ser IDEMPOTENTE: o mesmo evento
 * pode chegar mais de uma vez.
 *
 *   @Injectable()
 *   export class OnContactCreated {
 *     @HandlesDomainEvent(ContactCreatedEvent)
 *     async handle(event: DeliveredEvent<ContactCreatedEvent>) { ... }
 *   }
 *
 * (Exceção consciente à regra "application só usa @Injectable/@Inject":
 * é só um marcador de metadados, sem lógica do framework.)
 */
export const HandlesDomainEvent = (event: { readonly eventName: string }) =>
  SetMetadata(DOMAIN_EVENT_HANDLER, event.eventName);

/**
 * Como o evento chega ao handler: os dados do evento (sem métodos), mais o
 * id único da entrega — útil para idempotência.
 */
export type DeliveredEvent<E> = {
  [K in keyof E as E[K] extends (...args: never[]) => unknown ? never : K]: E[K] extends Date
    ? string
    : E[K];
} & { eventId: string };
