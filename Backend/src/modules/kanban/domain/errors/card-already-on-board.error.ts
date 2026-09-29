import { ConflictError } from '../../../../shared/domain/domain-error';

export class CardAlreadyOnBoardError extends ConflictError {
  readonly code = 'BOARD_CARD_ALREADY_EXISTS';

  constructor() {
    super('The conversation is already on this board');
  }
}
