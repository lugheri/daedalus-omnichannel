import { ConflictError } from '../../../../shared/domain/domain-error';

export class AlreadyMemberError extends ConflictError {
  readonly code = 'MEMBER_ALREADY_EXISTS';

  constructor() {
    super('This person is already a member of the account');
  }
}
