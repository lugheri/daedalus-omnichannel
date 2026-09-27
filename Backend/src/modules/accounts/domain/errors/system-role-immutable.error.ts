import { DomainError } from '../../../../shared/domain/domain-error';

export class SystemRoleImmutableError extends DomainError {
  readonly code = 'ROLE_SYSTEM_IMMUTABLE';

  constructor() {
    super('The Owner role cannot be changed or deleted');
  }
}
