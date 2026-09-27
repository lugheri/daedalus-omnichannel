import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Também para conversas fora do escopo do membro: não revela que existem. */
export class ConversationNotFoundError extends NotFoundError {
  readonly code = 'CONVERSATION_NOT_FOUND';

  constructor() {
    super('Conversation not found');
  }
}
