import { DomainError } from '../../../../shared/domain/domain-error';

export class ImportWithoutColumnsError extends DomainError {
  readonly code = 'IMPORT_NO_COLUMNS';

  constructor() {
    super('The spreadsheet needs a phone or email column');
  }
}
