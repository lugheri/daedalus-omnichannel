/**
 * Onde os sites ficam no ar: o bucket público de sites (ADR 0008). Cada site é
 * uma pasta: o slug (servido em `<slug>.SITES_DOMAIN`) e, com domínio próprio
 * (ADR 0011), o próprio host (`www.barbearia.com.br/`). As imagens ficam em
 * `media.SITES_DOMAIN`. Sem configuração (`enabled = false`), publicar e
 * enviar imagem recusam com `SITES_NOT_CONFIGURED`.
 */
export interface SiteHosting {
  readonly enabled: boolean;
  /** O domínio dos endereços nossos (`meusites.com.br`), ou null sem configuração. */
  readonly sitesDomain: string | null;
  /** Para onde o CNAME de um domínio próprio aponta (o túnel); null = não configurado. */
  readonly domainTarget: string | null;
  siteUrl(slug: string): string;
  /** Endereço de um domínio próprio (mesmo esquema e porta dos nossos). */
  domainUrl(host: string): string;
  mediaUrl(key: string): string;
  /** `<pasta>/index.html`; a pasta é o slug ou o host do domínio próprio. */
  publishPage(folder: string, html: string): Promise<void>;
  removePage(folder: string): Promise<void>;
  /** Arquivo pequeno de controle, servido sem cache (a verificação do domínio). */
  publishFile(folder: string, path: string, body: string, contentType: string): Promise<void>;
  removeFile(folder: string, path: string): Promise<void>;
  putMedia(key: string, body: Buffer, contentType: string): Promise<void>;
  removeMedia(key: string): Promise<void>;
}

export const SITE_HOSTING = Symbol('SiteHosting');
