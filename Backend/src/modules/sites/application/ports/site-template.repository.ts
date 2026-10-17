import type { SiteTemplate } from '../../domain/site-template.entity';

/**
 * Modelos de site. Os modelos são da conta que os mantém (a da plataforma) e
 * escolhidos por todas as outras: por isso há consultas SEM filtro de tenant,
 * de propósito e só de leitura — `findForSite`, `listAvailable` e
 * `countSitesUsing`. As demais são restritas ao tenant atual.
 */
export interface SiteTemplateRepository {
  save(template: SiteTemplate): Promise<void>;
  /** Modelo mantido pela conta atual. */
  findOwned(id: string): Promise<SiteTemplate | null>;
  /** Os mantidos pela conta atual, por nome. */
  listOwned(): Promise<SiteTemplate[]>;
  delete(template: SiteTemplate): Promise<void>;
  /** Qualquer conta: o modelo que um site usa (ou vai usar). */
  findForSite(id: string): Promise<SiteTemplate | null>;
  /** Qualquer conta: os disponíveis para escolha, por nome. */
  listAvailable(): Promise<SiteTemplate[]>;
  /** Qualquer conta: quantos sites usam o modelo. */
  countSitesUsing(id: string): Promise<number>;
}

export const SITE_TEMPLATE_REPOSITORY = Symbol('SiteTemplateRepository');
