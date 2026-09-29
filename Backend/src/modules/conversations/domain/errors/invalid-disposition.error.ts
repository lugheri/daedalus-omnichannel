import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidDispositionError extends DomainError {
  readonly code: 'DISPOSITION_INVALID_NAME' | 'DISPOSITION_INVALID_COLOR';

  constructor(field: 'name' | 'color') {
    super(field === 'name' ? 'Name must have 1 to 60 characters' : 'Unknown color');
    this.code = field === 'name' ? 'DISPOSITION_INVALID_NAME' : 'DISPOSITION_INVALID_COLOR';
  }
}
