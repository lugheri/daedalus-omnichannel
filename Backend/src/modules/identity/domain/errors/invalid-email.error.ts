import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidEmailError extends DomainError {
  readonly code = 'USER_INVALID_EMAIL';

  constructor(email: string) {
    super(`Invalid email: ${email}`);
  }
}
