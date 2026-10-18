import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidSiteCode =
  | 'SITE_INVALID_SLUG'
  | 'SITE_RESERVED_SLUG'
  | 'SITE_INVALID_DOMAIN'
  | 'SITE_DOMAIN_IS_OURS'
  | 'SITE_INVALID_BUSINESS_NAME'
  | 'SITE_INVALID_COLOR'
  | 'SITE_INVALID_WHATSAPP'
  | 'SITE_INVALID_EMAIL'
  | 'SITE_TOO_MANY_ITEMS'
  | 'SITE_UNKNOWN_ASSET'
  | 'SITE_TEMPLATE_INVALID_NAME'
  | 'SITE_TEMPLATE_INVALID_HTML'
  | 'SITE_ASSET_INVALID_TYPE'
  | 'SITE_ASSET_TOO_LARGE'
  | 'SITES_NOT_CONFIGURED'
  | 'LANDING_INVALID_NAME'
  | 'LANDING_INVALID_PATH'
  | 'LANDING_TOO_MANY_ITEMS'
  | 'LANDING_TOO_MANY_VARIANTS'
  | 'LANDING_LAST_VARIANT'
  | 'LANDING_INVALID_WEIGHT'
  | 'LANDING_NO_ACTIVE_VARIANT'
  | 'LANDING_UNKNOWN_FORM'
  | 'LANDING_SITE_REQUIRED'
  | 'SITE_TEMPLATE_WRONG_KIND';

/**
 * Regra do site ou do modelo violada (422). Em `SITE_TEMPLATE_INVALID_HTML`,
 * a `message` traz o motivo do Mustache (marcador não fechado etc.) para
 * quem edita o modelo.
 */
export class InvalidSiteError extends DomainError {
  constructor(
    readonly code: InvalidSiteCode,
    detail?: string,
  ) {
    super(detail ?? `Invalid site: ${code}`);
  }
}
