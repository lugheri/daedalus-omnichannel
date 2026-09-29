import type { ContactNote } from '../domain/contact-note.entity';
import type { Contact } from '../domain/contact.entity';

/**
 * Formato público do contato na API. Separado da entidade para que mudanças
 * internas não quebrem o contrato com o frontend (e vice-versa).
 */
export const ContactPresenter = {
  toHttp: (contact: Contact) => ({
    id: contact.id,
    name: contact.name,
    phone: contact.phone?.value ?? null,
    email: contact.email?.value ?? null,
    source: contact.source,
    sourceDetail: contact.sourceDetail,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }),
};

export const ContactNotePresenter = {
  toHttp: (note: ContactNote) => ({
    id: note.id,
    body: note.body,
    authorMembershipId: note.authorMembershipId,
    createdAt: note.createdAt.toISOString(),
  }),
};
