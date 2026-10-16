import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidCatalogItemCode =
  | 'SERVICE_INVALID_NAME'
  | 'SERVICE_INVALID_DESCRIPTION'
  | 'SERVICE_INVALID_DURATION'
  | 'SERVICE_INVALID_PRICE'
  | 'PROFESSIONAL_INVALID_NAME'
  | 'PROFESSIONAL_INVALID_TITLE'
  | 'PROFESSIONAL_INVALID_BIO'
  | 'PROFESSIONAL_INVALID_MEMBER'
  | 'PROFESSIONAL_UNKNOWN_SERVICES';

/** Regra de serviço ou profissional violada (422). */
export class InvalidCatalogItemError extends DomainError {
  constructor(readonly code: InvalidCatalogItemCode) {
    super(`Invalid catalog item: ${code}`);
  }
}
