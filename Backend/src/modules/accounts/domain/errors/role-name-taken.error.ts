import { ConflictError } from '../../../../shared/domain/domain-error';

export class RoleNameTakenError extends ConflictError {
  readonly code = 'ROLE_NAME_TAKEN';

  constructor() {
    super('A role with this name already exists');
  }
}
