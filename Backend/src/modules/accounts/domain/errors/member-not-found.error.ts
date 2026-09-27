import { NotFoundError } from '../../../../shared/domain/domain-error';

export class MemberNotFoundError extends NotFoundError {
  readonly code = 'MEMBER_NOT_FOUND';

  constructor() {
    super('Member not found');
  }
}
