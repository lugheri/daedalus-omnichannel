import { NotFoundError } from '../../../../shared/domain/domain-error';

export class AutomationNotFoundError extends NotFoundError {
  readonly code = 'AUTOMATION_NOT_FOUND';

  constructor() {
    super('Automation not found');
  }
}
