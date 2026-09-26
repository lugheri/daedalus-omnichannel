/**
 * Um fato que já aconteceu no domínio (nome no passado: ContactCreated).
 * `eventName` é o contrato público e versionado (`contact.created.v1`).
 */
export abstract class DomainEvent {
  abstract readonly eventName: string;
  readonly occurredAt = new Date();

  constructor(readonly aggregateId: string) {}
}
