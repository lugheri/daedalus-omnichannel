import { DomainError } from '../../../../shared/domain/domain-error';

export class ImportTooLargeError extends DomainError {
  readonly code = 'IMPORT_TOO_MANY_ROWS';

  constructor() {
    super('The spreadsheet has more rows than allowed');
  }
}
