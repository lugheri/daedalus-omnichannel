import { ForbiddenError } from '../../../../shared/domain/domain-error';

/** Modelos de site só são mantidos na conta da plataforma (403). */
export class SiteTemplatesRootOnlyError extends ForbiddenError {
  readonly code = 'SITE_TEMPLATES_ROOT_ONLY';

  constructor() {
    super('Site templates are managed only in the platform account');
  }
}
