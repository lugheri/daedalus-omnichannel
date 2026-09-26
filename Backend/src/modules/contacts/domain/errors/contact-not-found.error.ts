import { NotFoundError } from '../../../../shared/domain/domain-error';

export class ContactNotFoundError extends NotFoundError {
  readonly code = 'CONTACT_NOT_FOUND';

  constructor(id: string) {
    super(`Contact not found: ${id}`);
  }
}
