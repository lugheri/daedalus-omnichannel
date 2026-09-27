import { NotFoundError } from '../../../../shared/domain/domain-error';

export class InvitationNotFoundError extends NotFoundError {
  readonly code = 'INVITATION_NOT_FOUND';

  constructor() {
    super('Invitation not found, expired or already used');
  }
}
