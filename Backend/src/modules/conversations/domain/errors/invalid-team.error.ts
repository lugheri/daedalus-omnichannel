import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTeamError extends DomainError {
  readonly code = 'CONVERSATION_INVALID_TEAM';

  constructor() {
    super('Team not found');
  }
}
