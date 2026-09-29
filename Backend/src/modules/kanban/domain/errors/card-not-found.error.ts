import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Inexistente, de outro quadro ou de uma conversa que o membro não vê. */
export class CardNotFoundError extends NotFoundError {
  readonly code = 'BOARD_CARD_NOT_FOUND';

  constructor() {
    super('Card not found');
  }
}
