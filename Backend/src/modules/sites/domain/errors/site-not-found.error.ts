import { NotFoundError } from '../../../../shared/domain/domain-error';

export type SiteNotFoundCode =
  | 'SITE_NOT_FOUND'
  | 'SITE_TEMPLATE_NOT_FOUND'
  | 'SITE_ASSET_NOT_FOUND'
  | 'LANDING_NOT_FOUND'
  | 'LANDING_VARIANT_NOT_FOUND';

export class SiteNotFoundError extends NotFoundError {
  constructor(readonly code: SiteNotFoundCode) {
    super(`Not found: ${code}`);
  }
}
