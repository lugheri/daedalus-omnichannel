import type { Contact } from '../domain/contact.entity';

/**
 * Formato público do contato na API. Separado da entidade para que mudanças
 * internas não quebrem o contrato com o frontend (e vice-versa).
 */
export const ContactPresenter = {
  toHttp(contact: Contact) {
    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone?.value ?? null,
      email: contact.email?.value ?? null,
      createdAt: contact.createdAt.toISOString(),
    };
  },
};
