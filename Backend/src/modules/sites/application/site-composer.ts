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
    const [services, professionals, form, chat] = await Promise.all([
      this.sources.services(),
      this.sources.professionals(),
      content.contactFormId ? this.sources.form(content.contactFormId) : Promise.resolve(null),
      content.chatChannelId ? this.sources.chat(content.chatChannelId) : Promise.resolve(null),
    ]);
    const view = buildSiteView({
      content,
      siteUrl,
      assetUrl: (id) => urls.get(id) ?? null,
      services,
      professionals,
      form,
      chatEnabled: chat !== null,
    });
    const html = this.renderer.render(templateHtml, view);
    return chat ? withChatWidget(html, chat, options.preview === true) : html;
  }
}

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * O script do widget do chat antes do `</body>` (no fim, se o modelo não
 * tiver um): qualquer modelo ganha o chat sem mudar uma linha.
 */
export function withChatWidget(html: string, chat: SiteChatInfo, preview: boolean): string {
  const tag = `<script src="${attr(chat.scriptUrl)}" data-key="${attr(chat.key)}"${preview ? ' data-preview="1"' : ''} async></script>`;
  const at = html.toLowerCase().lastIndexOf('</body>');
  return at === -1 ? `${html}\n${tag}` : `${html.slice(0, at)}${tag}\n${html.slice(at)}`;
}
