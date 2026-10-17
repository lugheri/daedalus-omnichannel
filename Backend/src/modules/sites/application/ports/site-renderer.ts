/**
 * Gera o HTML do site a partir do modelo (marcadores Mustache) e do conteúdo.
 * Textos do conteúdo saem escapados; nada do modelo é executado no servidor.
 */
export interface SiteRenderer {
  /** O motivo, se o modelo não puder ser lido (marcador não fechado etc.); senão null. */
  check(html: string): string | null;
  /** Lança `InvalidSiteError('SITE_TEMPLATE_INVALID_HTML')` com o motivo. */
  render(html: string, view: object): string;
}

export const SITE_RENDERER = Symbol('SiteRenderer');
