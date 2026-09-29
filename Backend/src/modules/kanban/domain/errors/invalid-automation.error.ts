import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidAutomationCode =
  | 'AUTOMATION_INVALID_TRIGGER'
  | 'AUTOMATION_INVALID_ACTIONS'
  | 'AUTOMATION_INVALID_MESSAGE'
  | 'AUTOMATION_INVALID_ASSIGN'
  | 'AUTOMATION_INVALID_MOVE'
  | 'AUTOMATION_INVALID_IDLE_TIME'
  | 'AUTOMATION_INVALID_TEAM'
  | 'AUTOMATION_INVALID_ASSIGNEE'
  | 'AUTOMATION_INVALID_DISPOSITION'
  | 'AUTOMATION_TOO_MANY';

/** Regra de automação inválida (422). */
export class InvalidAutomationError extends DomainError {
  constructor(readonly code: InvalidAutomationCode) {
    super(`Invalid automation: ${code}`);
  }
}
