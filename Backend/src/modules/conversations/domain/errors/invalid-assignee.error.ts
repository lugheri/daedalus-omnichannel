import { DomainError } from '../../../../shared/domain/domain-error';

/** O responsável indicado não é um membro ativo da conta. */
export class InvalidAssigneeError extends DomainError {
  readonly code = 'CONVERSATION_INVALID_ASSIGNEE';

  constructor() {
    super('The assignee must be an active member of the account');
  }
}
