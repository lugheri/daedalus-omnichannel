import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidUserNameError extends DomainError {
  readonly code = 'USER_INVALID_NAME';

  constructor() {
    super('User name must not be empty');
  }
}
