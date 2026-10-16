import { ConflictError } from '../../../../shared/domain/domain-error';

export type CatalogConflictCode = 'SERVICE_NAME_TAKEN' | 'PROFESSIONAL_MEMBER_TAKEN';

/** Já existe serviço com esse nome, ou o membro já é outro profissional (409). */
export class CatalogConflictError extends ConflictError {
  constructor(readonly code: CatalogConflictCode) {
    super(`Catalog conflict: ${code}`);
  }
}
