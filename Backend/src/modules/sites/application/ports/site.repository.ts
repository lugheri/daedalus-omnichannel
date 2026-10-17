import type { Site } from '../../domain/site.entity';

/**
 * Restrito ao tenant atual, exceto `isSlugTaken` (o endereço é único entre
 * todas as contas).
 *
 * Duas gravações, porque a tela e o worker mexem no mesmo site ao mesmo
 * tempo: `save` grava o que a pessoa edita (conteúdo, endereço, modelo) e
 * `savePublication` só o estado da publicação. Uma não desfaz a outra.
 */
export interface SiteRepository {
  /**
   * Cria o site ou grava a edição. Lança `SiteConflictError('SITE_SLUG_TAKEN'
   * | 'SITE_ALREADY_EXISTS')` se outro site levar o endereço (ou a conta já
   * tiver site) no meio do caminho.
   */
  save(site: Site): Promise<void>;
  /** Só `publishedSlug`, `publishedAt`, `pendingAction` e `lastError`. */
  savePublication(site: Site): Promise<void>;
  /** O site da conta atual (um por conta). */
  findCurrent(): Promise<Site | null>;
  findById(id: string): Promise<Site | null>;
  /** Endereço usado (ou ainda no ar) por outro site. */
  isSlugTaken(slug: string, exceptSiteId: string | null): Promise<boolean>;
}

export const SITE_REPOSITORY = Symbol('SiteRepository');
