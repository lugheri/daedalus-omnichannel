import { ConflictError } from '../../../../shared/domain/domain-error';

export class ContactAlreadyExistsError extends ConflictError {
  readonly code = 'CONTACT_ALREADY_EXISTS';

  constructor(readonly field: 'phone' | 'email') {
    super(`A contact with this ${field} already exists`);
  }
}
