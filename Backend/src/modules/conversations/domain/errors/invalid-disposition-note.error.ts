import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidDispositionNoteError extends DomainError {
  readonly code = 'CONVERSATION_DISPOSITION_NOTE_INVALID';

  constructor() {
    super('The note must have at most 1000 characters');
  }
}
