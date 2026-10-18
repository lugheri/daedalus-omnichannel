import { Inject, Injectable } from '@nestjs/common';
import { landingAssetIds, type LandingContent } from '../domain/landing-content';
import { publicAssetKey } from '../domain/site-asset';
import { referencedAssetIds, type SiteContent } from '../domain/site-content';
import { viewBeaconScript } from './landing-pages';
import { buildLandingView } from './landing-view';
import { LANDING_BEACON, type LandingBeacon } from './ports/landing-beacon';
import { SITE_ASSET_REPOSITORY, type SiteAssetRepository } from './ports/site-asset.repository';
import { SITE_HOSTING, type SiteHosting } from './ports/site-hosting';
import { SITE_RENDERER, type SiteRenderer } from './ports/site-renderer';
import { SITE_SOURCES, type SiteSources } from './ports/site-sources';

/** Origem do envio que o forms repassa no `form.submitted.v1` (conversão da variante). */
export const LANDING_REF_PREFIX = 'lp:';

export interface LandingRenderInput {
  site: SiteContent;
  landing: LandingContent;
  variantId: string;
  variantCode: string;
  pageUrl: string | null;
  homeUrl: string | null;
  formId: string | null;
}

/**
 * Monta o HTML de uma variante de landing page no modelo dela. Publicado (não
 * prévia), o formulário leva a variante na ação (`?ref=lp:<id>`: o envio conta
 * como conversão dela) e a página ganha o aviso de visita.
 */
@Injectable()
export class LandingComposer {
  constructor(
    @Inject(SITE_SOURCES) private readonly sources: SiteSources,
    @Inject(SITE_ASSET_REPOSITORY) private readonly assets: SiteAssetRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(SITE_RENDERER) private readonly renderer: SiteRenderer,
    @Inject(LANDING_BEACON) private readonly beacon: LandingBeacon,
  ) {}

  async render(
    templateHtml: string,
    input: LandingRenderInput,
    options: { preview?: boolean } = {},
  ): Promise<string> {
    const preview = options.preview === true;
    const ids = [
      ...new Set([...referencedAssetIds(input.site), ...landingAssetIds(input.landing)]),
    ];
    const assets = await this.assets.findByIds(ids);
    const urls = new Map(
      assets.map((asset) => [
        asset.id,
        this.hosting.enabled ? this.hosting.mediaUrl(publicAssetKey(asset)) : null,
      ]),
    );
    const [services, form] = await Promise.all([
      this.sources.services(),
      input.formId ? this.sources.form(input.formId) : Promise.resolve(null),
    ]);
    const view = buildLandingView({
      site: input.site,
      landing: input.landing,
      pageUrl: input.pageUrl,
      homeUrl: input.homeUrl,
      assetUrl: (id) => urls.get(id) ?? null,
      services,
      form:
        form && !preview
          ? {
              ...form,
              actionUrl: withRef(form.actionUrl, `${LANDING_REF_PREFIX}${input.variantId}`),
            }
          : form,
      variant: input.variantCode,
    });
    const html = this.renderer.render(templateHtml, view);
    if (preview) return html;
    const script = viewBeaconScript(input.variantId, this.beacon.viewUrl(input.variantId));
    const at = html.toLowerCase().lastIndexOf('</body>');
    return at === -1 ? `${html}\n${script}` : `${html.slice(0, at)}${script}\n${html.slice(at)}`;
  }
}

function withRef(url: string, ref: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;
}
