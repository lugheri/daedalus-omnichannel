import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidDealCode =
  | 'DEAL_INVALID_TITLE'
  | 'DEAL_INVALID_VALUE'
  | 'DEAL_INVALID_LOST_REASON'
  | 'DEAL_INVALID_OWNER'
  | 'DEAL_NOT_OPEN'
  | 'DEAL_NOT_CLOSED';

/** Regra do negócio violada (422). */
export class InvalidDealError extends DomainError {
  constructor(readonly code: InvalidDealCode) {
    super(`Invalid deal: ${code}`);
  }
}
