import { NotFoundError } from '../../../../shared/domain/domain-error';

export class NoteNotFoundError extends NotFoundError {
  readonly code = 'CONTACT_NOTE_NOT_FOUND';

  constructor() {
    super('Note not found');
  }
}
