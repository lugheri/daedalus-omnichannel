import { NotFoundError } from '../../../../shared/domain/domain-error';

export class MessagingContactNotFoundError extends NotFoundError {
  readonly code = 'MESSAGING_CONTACT_NOT_FOUND';

  constructor() {
    super('Contact not found');
  }
}
