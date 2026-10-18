import { Inject, Injectable } from '@nestjs/common';
import { publicAssetKey } from '../domain/site-asset';
import { referencedAssetIds, type SiteContent } from '../domain/site-content';
import { SITE_ASSET_REPOSITORY, type SiteAssetRepository } from './ports/site-asset.repository';
import { SITE_HOSTING, type SiteHosting } from './ports/site-hosting';
import { SITE_RENDERER, type SiteRenderer } from './ports/site-renderer';
import { SITE_SOURCES, type SiteChatInfo, type SiteSources } from './ports/site-sources';
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

  /** `preview`: o widget do chat aparece em modo prévia (não identifica nem envia). */
  async render(
    templateHtml: string,
    content: SiteContent,
    siteUrl: string | null,
    options: { preview?: boolean } = {},
  ): Promise<string> {
    const assets = await this.assets.findByIds(referencedAssetIds(content));
    const urls = new Map(
      assets.map((asset) => [
        asset.id,
        this.hosting.enabled ? this.hosting.mediaUrl(publicAssetKey(asset)) : null,
      ]),
    );
    const [services, professionals, form, chat, booking] = await Promise.all([
      this.sources.services(),
      this.sources.professionals(),
      content.contactFormId ? this.sources.form(content.contactFormId) : Promise.resolve(null),
      content.chatChannelId ? this.sources.chat(content.chatChannelId) : Promise.resolve(null),
      content.sections.booking ? this.sources.booking() : Promise.resolve(null),
    ]);
    const view = buildSiteView({
      content,
      siteUrl,
      assetUrl: (id) => urls.get(id) ?? null,
      services,
      professionals,
      form,
      chatEnabled: chat !== null,
      bookingEnabled: booking !== null,
    });
    const preview = options.preview === true;
    let html = this.renderer.render(templateHtml, view);
    if (booking) html = withWidget(withBookingPlace(html), booking, preview);
    if (chat) html = withWidget(html, chat, preview);
    return html;
  }
}

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function insertBefore(html: string, marker: string, piece: string): string | null {
  const at = html.toLowerCase().lastIndexOf(marker);
  return at === -1 ? null : `${html.slice(0, at)}${piece}\n${html.slice(at)}`;
}

/**
 * O script de um widget (chat, agendamento) antes do `</body>` (no fim, se o
 * modelo não tiver um): qualquer modelo ganha o widget sem mudar uma linha.
 */
export function withWidget(html: string, widget: SiteChatInfo, preview: boolean): string {
  const tag = `<script src="${attr(widget.scriptUrl)}" data-key="${attr(widget.key)}"${preview ? ' data-preview="1"' : ''} async></script>`;
  return insertBefore(html, '</body>', tag) ?? `${html}\n${tag}`;
}

/**
 * O lugar do agendamento: o modelo marca com `<div data-omni-booking>` (o
 * inicial tem uma seção "Agende seu horário"); modelo sem o lugar ganha uma
 * seção antes do rodapé.
 */
function withBookingPlace(html: string): string {
  if (html.includes('data-omni-booking')) return html;
  const place =
    '<section id="agendar" style="padding:48px 20px;max-width:1100px;margin:0 auto"><div data-omni-booking></div></section>';
  return (
    insertBefore(html, '<footer', place) ??
    insertBefore(html, '</body>', place) ??
    `${html}\n${place}`
  );
}
