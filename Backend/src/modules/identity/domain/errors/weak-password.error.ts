import { DomainError } from '../../../../shared/domain/domain-error';

export class WeakPasswordError extends DomainError {
  readonly code = 'USER_WEAK_PASSWORD';

  constructor(minLength: number, maxLength: number) {
    super(`Password must have between ${minLength} and ${maxLength} characters`);
  }
}
