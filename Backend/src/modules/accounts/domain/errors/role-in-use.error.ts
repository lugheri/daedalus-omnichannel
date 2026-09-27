import { ConflictError } from '../../../../shared/domain/domain-error';

export class RoleInUseError extends ConflictError {
  readonly code = 'ROLE_IN_USE';

  constructor() {
    super('The role is assigned to members or pending invitations');
  }
}
