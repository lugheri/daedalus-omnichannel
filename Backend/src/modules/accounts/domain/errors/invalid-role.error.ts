import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidRoleError extends DomainError {
  readonly code = 'ROLE_INVALID';

  constructor(reason: string) {
    super(`Invalid role: ${reason}`);
  }
}
