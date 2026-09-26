import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidEmailError extends DomainError {
  readonly code = 'CONTACT_INVALID_EMAIL';

  constructor(email: string) {
    super(`Invalid email: ${email}`);
  }
}
