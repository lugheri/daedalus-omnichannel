import { ConflictError } from '../../../../shared/domain/domain-error';

export class EmailAlreadyInUseError extends ConflictError {
  readonly code = 'USER_EMAIL_ALREADY_IN_USE';

  constructor() {
    super('This email is already registered');
  }
}
