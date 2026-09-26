import type { ContactModel } from '../../../shared/infra/prisma/generated/models';
import { Contact } from '../domain/contact.entity';
import { Email } from '../domain/email.vo';
import { Phone } from '../domain/phone.vo';

/**
 * Tradução entre o formato do banco (tipos do Prisma) e a entidade de domínio.
 * É o único lugar do módulo que conhece os dois lados — os tipos do Prisma
 * nunca saem da camada de infra.
 */
export const ContactMapper = {
  toDomain(row: ContactModel): Contact {
    return Contact.restore(row.id, {
      tenantId: row.tenantId,
      name: row.name,
      phone: row.phone ? Phone.create(row.phone) : null,
      email: row.email ? Email.create(row.email) : null,
      createdAt: row.createdAt,
    });
  },

  toPersistence(contact: Contact): ContactModel {
    return {
      id: contact.id,
      tenantId: contact.tenantId,
      name: contact.name,
      phone: contact.phone?.value ?? null,
      email: contact.email?.value ?? null,
      createdAt: contact.createdAt,
    };
  },
};
