import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidInvitationEmailError extends DomainError {
  readonly code = 'INVITATION_INVALID_EMAIL';

  constructor() {
    super('Invalid email');
  }
}
