import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Conversa inexistente ou fora do escopo do membro. */
export class BoardConversationNotFoundError extends NotFoundError {
  readonly code = 'BOARD_CONVERSATION_NOT_FOUND';

  constructor() {
    super('Conversation not found');
  }
}
