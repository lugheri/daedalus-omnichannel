import { ForbiddenError } from '../../../../shared/domain/domain-error';

export class NoteNotYoursError extends ForbiddenError {
  readonly code = 'CONTACT_NOTE_NOT_YOURS';

  constructor() {
    super('Only the author can delete a note');
  }
}
