import type { LandingPage } from '../../domain/landing-page.entity';

/**
 * Landing pages da conta atual (com as variantes), exceto
 * `findVariantOwnerAsSystem` (a rota pública de visitas ainda não tem conta:
 * a variante diz qual é).
 *
 * Como no site, a tela e o worker gravam coisas diferentes: `save` grava a
 * edição (página e variantes) e `savePublication` só o estado da publicação.
 */
export interface LandingPageRepository {
  /** Lança `SiteConflictError('LANDING_PATH_TAKEN')` se outra página levar o caminho no meio. */
  save(page: LandingPage): Promise<void>;
  savePublication(page: LandingPage): Promise<void>;
  findById(id: string): Promise<LandingPage | null>;
  /** Da mais nova para a mais antiga. */
  list(): Promise<LandingPage[]>;
  count(): Promise<number>;
  /** Caminho usado (ou ainda no ar) por outra página da conta. */
  isPathTaken(path: string, exceptPageId: string | null): Promise<boolean>;
  /** As que estão no ar (para mudar de pasta quando o site muda de endereço). */
  listLive(): Promise<LandingPage[]>;
  delete(page: LandingPage): Promise<void>;
  /** Alguma variante usa a imagem (não deixa excluir). */
  isAssetUsed(assetId: string): Promise<boolean>;
  /** SEM filtro de tenant (rota pública): a conta e a página da variante, e se está no ar. */
  findVariantOwnerAsSystem(
    variantId: string,
  ): Promise<{ tenantId: string; landingPageId: string; live: boolean } | null>;
}

export const LANDING_PAGE_REPOSITORY = Symbol('LandingPageRepository');
