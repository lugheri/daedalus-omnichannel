import { ConflictError } from '../../../../shared/domain/domain-error';

export class ConversationAlreadyAssignedError extends ConflictError {
  readonly code = 'CONVERSATION_ALREADY_ASSIGNED';

  constructor() {
    super('The conversation already has an assignee');
  }
}
