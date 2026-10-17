import { ConflictError } from '../../../../shared/domain/domain-error';

export type SiteConflictCode =
  'SITE_ALREADY_EXISTS' | 'SITE_SLUG_TAKEN' | 'SITE_TEMPLATE_IN_USE' | 'SITE_ASSET_IN_USE';

export class SiteConflictError extends ConflictError {
  constructor(readonly code: SiteConflictCode) {
    super(`Site conflict: ${code}`);
  }
}
