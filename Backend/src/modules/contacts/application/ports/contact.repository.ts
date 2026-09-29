import type { CursorPage, PageRequest } from '../../../../shared/application/pagination';
import type { Contact } from '../../domain/contact.entity';
import type { Email } from '../../domain/email.vo';
import type { LeadSource } from '../../domain/lead-source';
import type { Phone } from '../../domain/phone.vo';

export interface ContactListQuery extends PageRequest {
  /** Trecho do nome, do e-mail ou do telefone (só dígitos). */
  search?: string;
  source?: LeadSource;
}

/**
 * Port de persistência de contatos. Toda operação é restrita ao tenant da
 * operação atual — a implementação obtém o tenant do TenantContext, por isso
 * nenhum método recebe `tenantId`.
 */
export interface ContactRepository {
  /** Lança `ContactAlreadyExistsError` se violar a unicidade de telefone/e-mail. */
  save(contact: Contact): Promise<void>;
  findById(id: string): Promise<Contact | null>;
  findByIds(ids: string[]): Promise<Contact[]>;
  findByPhone(phone: Phone): Promise<Contact | null>;
  findByEmail(email: Email): Promise<Contact | null>;
  /** Mais recentes primeiro, com busca e filtro opcionais. */
  list(query: ContactListQuery): Promise<CursorPage<Contact>>;
}

export const CONTACT_REPOSITORY = Symbol('ContactRepository');
