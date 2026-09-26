import { DomainEvent } from '../../../../shared/domain/domain-event';

export class UserRegisteredEvent extends DomainEvent {
  static readonly eventName = 'user.registered.v1';
  readonly eventName = UserRegisteredEvent.eventName;

  constructor(
    aggregateId: string,
    readonly email: string,
  ) {
    super(aggregateId);
  }
}
