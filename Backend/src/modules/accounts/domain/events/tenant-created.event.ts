import { DomainEvent } from '../../../../shared/domain/domain-event';

export class TenantCreatedEvent extends DomainEvent {
  static readonly eventName = 'tenant.created.v1';
  readonly eventName = TenantCreatedEvent.eventName;
  /** O próprio tenant: consumidores rodam no contexto dele. */
  readonly tenantId: string;

  constructor(
    aggregateId: string,
    readonly name: string,
  ) {
    super(aggregateId);
    this.tenantId = aggregateId;
  }
}
