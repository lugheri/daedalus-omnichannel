import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTenantNameError extends DomainError {
  readonly code = 'ACCOUNT_INVALID_NAME';

  constructor() {
    super('Account name must have between 2 and 100 characters');
  }
}
