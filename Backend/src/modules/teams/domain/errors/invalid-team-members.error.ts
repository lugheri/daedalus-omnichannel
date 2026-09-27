import { DomainError } from '../../../../shared/domain/domain-error';

/** Algum id não é um membro ativo da conta. */
export class InvalidTeamMembersError extends DomainError {
  readonly code = 'TEAM_INVALID_MEMBERS';

  constructor() {
    super('Every team member must be an active member of the account');
  }
}
