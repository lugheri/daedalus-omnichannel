import { DomainEvent } from '../../../../shared/domain/domain-event';

export class ContactCreatedEvent extends DomainEvent {
  static readonly eventName = 'contact.created.v1';
  readonly eventName = ContactCreatedEvent.eventName;

  constructor(
    aggregateId: string,
    readonly tenantId: string,
  ) {
    super(aggregateId);
  }
}
