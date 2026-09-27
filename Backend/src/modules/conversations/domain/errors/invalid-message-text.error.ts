import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidMessageTextError extends DomainError {
  readonly code = 'MESSAGE_INVALID_TEXT';

  constructor() {
    super('Message text must have between 1 and 4096 characters');
  }
}
