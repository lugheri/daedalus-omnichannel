import { ConflictError } from '../../../../shared/domain/domain-error';

/** Responder pelo WhatsApp exige o telefone do contato. */
export class ContactWithoutPhoneError extends ConflictError {
  readonly code = 'CONVERSATION_CONTACT_WITHOUT_PHONE';

  constructor() {
    super('The contact of this conversation has no phone number');
  }
}
