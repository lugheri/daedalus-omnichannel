import { NotFoundError } from '../../../../shared/domain/domain-error';

export class TimeOffNotFoundError extends NotFoundError {
  readonly code = 'TIME_OFF_NOT_FOUND';

  constructor() {
    super('Time off not found');
  }
}
