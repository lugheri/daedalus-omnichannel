import { NotFoundError } from '../../../../shared/domain/domain-error';

/** Inexistente, de outra conta ou (para tabular) arquivada. */
export class DispositionNotFoundError extends NotFoundError {
  readonly code = 'DISPOSITION_NOT_FOUND';

  constructor() {
    super('Disposition not found');
  }
}
