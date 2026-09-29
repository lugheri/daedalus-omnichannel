import type { ContactModel } from '../../../shared/infra/prisma/generated/models';
import { Contact } from '../domain/contact.entity';
import { Email } from '../domain/email.vo';
import { isLeadSource } from '../domain/lead-source';
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
      source: isLeadSource(row.source) ? row.source : 'manual',
      sourceDetail: row.sourceDetail,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(contact: Contact): ContactModel {
    return {
      id: contact.id,
      tenantId: contact.tenantId,
      name: contact.name,
      phone: contact.phone?.value ?? null,
      email: contact.email?.value ?? null,
      source: contact.source,
      sourceDetail: contact.sourceDetail,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  },
};
