import { ConflictError } from '../../../../shared/domain/domain-error';

/**
 * Outra entrada automática acabou de abrir o negócio deste contato neste
 * funil (índice único parcial no banco). Para a entrada automática significa
 * "já existe"; não chega ao HTTP.
 */
export class DealAutoEntryTakenError extends ConflictError {
  readonly code = 'DEAL_AUTO_ENTRY_TAKEN';

  constructor() {
    super('The contact already has an automatic open deal on this board');
  }
}
