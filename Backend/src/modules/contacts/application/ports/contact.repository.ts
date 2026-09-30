import type { CursorPage, PageRequest } from '../../../../shared/application/pagination';
import type { Contact } from '../../domain/contact.entity';
import type { Email } from '../../domain/email.vo';
import type { LeadSource } from '../../domain/lead-source';
import type { Phone } from '../../domain/phone.vo';

/** Filtro de contatos (lista da tela e público de campanhas). */
export interface ContactFilter {
  /** Trecho do nome, do e-mail ou do telefone (só dígitos). */
  search?: string;
  source?: LeadSource;
  /** Detalhe da origem, exato sem diferenciar maiúsculas (campanha do site, lote de importação). */
  sourceDetail?: string;
}

export interface ContactListQuery extends PageRequest, ContactFilter {}

export interface AudienceCount {
  total: number;
  withEmail: number;
  withPhone: number;
}

export interface SourceDetailCount {
  source: LeadSource;
  detail: string;
  count: number;
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
  /** Dos telefones/e-mails informados (normalizados), os que já existem — importação em lote. */
  findExistingIdentifiers(
    phones: string[],
    emails: string[],
  ): Promise<{ phones: Set<string>; emails: Set<string> }>;
  /** Mais recentes primeiro, com busca e filtros opcionais. */
  list(query: ContactListQuery): Promise<CursorPage<Contact>>;
  /** Quantos casam com o filtro, e quantos desses têm e-mail / telefone. */
  count(filter: ContactFilter): Promise<AudienceCount>;
  /** Detalhes de origem em uso (campanhas, lotes), com quantos contatos cada. */
  listSourceDetails(): Promise<SourceDetailCount[]>;
}

export const CONTACT_REPOSITORY = Symbol('ContactRepository');
