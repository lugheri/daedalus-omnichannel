import { NotFoundError } from '../../../../shared/domain/domain-error';

export type CatalogItemNotFoundCode = 'SERVICE_NOT_FOUND' | 'PROFESSIONAL_NOT_FOUND';

export class CatalogItemNotFoundError extends NotFoundError {
  constructor(readonly code: CatalogItemNotFoundCode) {
    super(`Not found: ${code}`);
  }
}
