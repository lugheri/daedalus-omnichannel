/** Serviço que pode ser pedido pelo site (módulo catalog): ativo e "mostrar no site". */
export interface SiteService {
  id: string;
  name: string;
  priceCents: number | null;
}

export interface ServiceCatalog {
  /** null se não existe, está inativo ou não aparece no site. */
  siteService(id: string): Promise<SiteService | null>;
}

export const SERVICE_CATALOG = Symbol('FormsServiceCatalog');
