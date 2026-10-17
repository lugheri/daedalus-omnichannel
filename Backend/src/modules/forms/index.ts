/**
 * API pública do módulo forms. Outros módulos só podem importar daqui.
 */
export { FormsFacade, type SiteFormSummary } from './application/forms.facade';
export { FormSubmittedEvent } from './domain/events/form-submitted.event';
export { FormsModule } from './forms.module';
