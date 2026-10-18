import { InvalidSiteError } from '../domain/errors/invalid-site.error';
import { SiteNotFoundError } from '../domain/errors/site-not-found.error';
import type { SiteTemplate, SiteTemplateKind } from '../domain/site-template.entity';
import type { SiteTemplateRepository } from './ports/site-template.repository';

/**
 * Modelo que a conta pode escolher (disponível e do tipo certo), ou o que já
 * usa. Também usado pelas landing pages (`kind = landing`).
 */
export async function choosableTemplate(
  templates: SiteTemplateRepository,
  id: string,
  current: string | null,
  kind: SiteTemplateKind = 'site',
): Promise<SiteTemplate> {
  const template = await templates.findForSite(id);
  if (!template || (!template.available && template.id !== current)) {
    throw new SiteNotFoundError('SITE_TEMPLATE_NOT_FOUND');
  }
  if (template.kind !== kind) throw new InvalidSiteError('SITE_TEMPLATE_WRONG_KIND');
  return template;
}
