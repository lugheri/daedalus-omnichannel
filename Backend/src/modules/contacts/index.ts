/**
 * API pública do módulo contacts. Outros módulos só podem importar daqui —
 * o lint barra imports de arquivos internos (domain/, application/...).
 */
export { ContactsFacade, type ContactSummary } from './application/contacts.facade';
export { ContactsModule } from './contacts.module';
export { ContactCreatedEvent } from './domain/events/contact-created.event';
