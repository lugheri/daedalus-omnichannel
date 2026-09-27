import { NotFoundError } from '../../../../shared/domain/domain-error';

export class RoleNotFoundError extends NotFoundError {
  readonly code = 'ROLE_NOT_FOUND';

  constructor() {
    super('Role not found');
  }
}
