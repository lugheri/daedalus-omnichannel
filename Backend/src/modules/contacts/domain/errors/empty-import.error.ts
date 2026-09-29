import { DomainError } from '../../../../shared/domain/domain-error';

export class EmptyImportError extends DomainError {
  readonly code = 'IMPORT_EMPTY';

  constructor() {
    super('The spreadsheet has no rows');
  }
}
