import { ForbiddenError } from '../../../../shared/domain/domain-error';

export class ForbiddenScopeError extends ForbiddenError {
  readonly code = 'AUTH_MISSING_PERMISSION';

  constructor() {
    super('No permission to view conversations');
  }
}
