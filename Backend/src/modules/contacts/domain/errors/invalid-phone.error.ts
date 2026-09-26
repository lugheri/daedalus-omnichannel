import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidPhoneError extends DomainError {
  readonly code = 'CONTACT_INVALID_PHONE';

  constructor(phone: string) {
    super(`Invalid phone number: ${phone}`);
  }
}
