import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidNoteError extends DomainError {
  readonly code = 'CONTACT_NOTE_INVALID';

  constructor() {
    super('A note must have between 1 and 5000 characters');
  }
}
