import { ConflictError } from '../../../../shared/domain/domain-error';

/** Já usada em atendimentos: não se apaga (sumiria do histórico) — arquive. */
export class DispositionInUseError extends ConflictError {
  readonly code = 'DISPOSITION_IN_USE';

  constructor() {
    super('The disposition was already used; archive it instead');
  }
}
