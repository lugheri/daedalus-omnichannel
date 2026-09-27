import { DomainError } from '../../../../shared/domain/domain-error';

export class CannotDisableSelfError extends DomainError {
  readonly code = 'MEMBER_CANNOT_DISABLE_SELF';

  constructor() {
    super('You cannot disable your own access');
  }
}
