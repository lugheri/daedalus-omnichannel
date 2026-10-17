import { NotFoundError } from '../../../../shared/domain/domain-error';

export type DealNotFoundCode = 'DEAL_NOT_FOUND' | 'DEAL_CONTACT_NOT_FOUND';

/**
 * Negócio inexistente, de outro funil ou fora do que o membro vê; ou contato
 * do negócio inexistente.
 */
export class DealNotFoundError extends NotFoundError {
  constructor(readonly code: DealNotFoundCode = 'DEAL_NOT_FOUND') {
    super(`Not found: ${code}`);
  }
}
