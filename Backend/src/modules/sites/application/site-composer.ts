import { Inject, Injectable } from '@nestjs/common';
import { publicAssetKey } from '../domain/site-asset';
import { referencedAssetIds, type SiteContent } from '../domain/site-content';
import { SITE_ASSET_REPOSITORY, type SiteAssetRepository } from './ports/site-asset.repository';
import { SITE_HOSTING, type SiteHosting } from './ports/site-hosting';
import { SITE_RENDERER, type SiteRenderer } from './ports/site-renderer';
import { SITE_SOURCES, type SiteSources } from './ports/site-sources';
import { buildSiteView } from './site-view';

/**
 * Monta o HTML de um site: conteúdo + serviços e profissionais do catálogo +
 * formulário + URLs das imagens, no modelo. O mesmo para a prévia e para a
 * publicação — o que se vê na prévia é o que vai ao ar.
 */
@Injectable()
export class SiteComposer {
  constructor(
    @Inject(SITE_SOURCES) private readonly sources: SiteSources,
    @Inject(SITE_ASSET_REPOSITORY) private readonly assets: SiteAssetRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(SITE_RENDERER) private readonly renderer: SiteRenderer,
  ) {}

  async render(
    templateHtml: string,
    content: SiteContent,
    siteUrl: string | null,
  ): Promise<string> {
    const assets = await this.assets.findByIds(referencedAssetIds(content));
    const urls = new Map(
      assets.map((asset) => [
        asset.id,
        this.hosting.enabled ? this.hosting.mediaUrl(publicAssetKey(asset)) : null,
      ]),
    );
    const [services, professionals, form] = await Promise.all([
      this.sources.services(),
      this.sources.professionals(),
      content.contactFormId ? this.sources.form(content.contactFormId) : Promise.resolve(null),
    ]);
    const view = buildSiteView({
      content,
      siteUrl,
      assetUrl: (id) => urls.get(id) ?? null,
      services,
      professionals,
      form,
    });
    return this.renderer.render(templateHtml, view);
  }
}
