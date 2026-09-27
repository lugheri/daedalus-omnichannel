import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidRecipientError extends DomainError {
  readonly code = 'CHANNEL_INVALID_RECIPIENT';

  constructor() {
    super('Recipient must be a valid phone number (with area code, or international with +)');
  }
}
