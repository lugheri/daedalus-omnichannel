import { Injectable } from '@nestjs/common';
import { Writer } from 'mustache';
import type { SiteRenderer } from '../application/ports/site-renderer';
import { InvalidSiteError } from '../domain/errors/invalid-site.error';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapa o que fecha tag, atributo ou entidade. O padrão do Mustache também
 * troca `/`, `=` e crase, o que deixa as URLs do site ilegíveis sem proteger
 * mais nada em atributos entre aspas (os modelos usam aspas).
 */
function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

/**
 * Renderizador sobre o Mustache (sem lógica no modelo; `{{x}}` sai escapado,
 * `{{{x}}}` não). Um `Writer` por chamada: o cache de modelos do Mustache
 * global cresceria sem limite com cada versão de cada modelo. Partials
 * (`{{> x}}`) não existem aqui e saem vazios.
 */
@Injectable()
export class MustacheSiteRenderer implements SiteRenderer {
  check(html: string): string | null {
    try {
      new Writer().parse(html);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  render(html: string, view: object): string {
    try {
      return new Writer().render(html, view, undefined, { escape: escapeHtml });
    } catch (error) {
      throw new InvalidSiteError(
        'SITE_TEMPLATE_INVALID_HTML',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
