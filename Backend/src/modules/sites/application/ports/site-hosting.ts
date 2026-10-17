/**
 * Onde os sites ficam no ar: o bucket público de sites (ADR 0008), servido
 * em `<slug>.SITES_DOMAIN`. As imagens ficam em `media.SITES_DOMAIN`.
 * Sem configuração (`enabled = false`), publicar e enviar imagem recusam com
 * `SITES_NOT_CONFIGURED`.
 */
export interface SiteHosting {
  readonly enabled: boolean;
  siteUrl(slug: string): string;
  mediaUrl(key: string): string;
  publishPage(slug: string, html: string): Promise<void>;
  removePage(slug: string): Promise<void>;
  putMedia(key: string, body: Buffer, contentType: string): Promise<void>;
  removeMedia(key: string): Promise<void>;
}

export const SITE_HOSTING = Symbol('SiteHosting');
