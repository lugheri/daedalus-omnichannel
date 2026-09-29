import { NotFoundError } from '../../../../shared/domain/domain-error';

export class BoardNotFoundError extends NotFoundError {
  readonly code = 'BOARD_NOT_FOUND';

  constructor() {
    super('Board not found');
  }
}
