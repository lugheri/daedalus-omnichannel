/**
 * API pública do módulo catalog. Outros módulos só podem importar daqui.
 */
export {
  CatalogFacade,
  type SiteOffering,
  type SiteProfessional,
  type SiteServiceSummary,
} from './application/catalog.facade';
export { CatalogModule } from './catalog.module';
