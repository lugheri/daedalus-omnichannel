/** O que o messaging precisa dos contatos (módulo contacts). Adapter em infra/. */
export interface MessagingContact {
  id: string;
  name: string | null;
  email: string | null;
  /** E.164. */
  phone: string | null;
}

/** Filtro de contatos do público de uma campanha. */
export interface AudienceFilter {
  search?: string;
  source?: string;
  sourceDetail?: string;
}

export interface ContactDirectory {
  findById(id: string): Promise<MessagingContact | null>;
  findByIds(ids: string[]): Promise<MessagingContact[]>;
  /** Uma página do público (por id, com cursor). */
  audiencePage(
    filter: AudienceFilter,
    page: { cursor?: string; limit: number },
  ): Promise<{ items: MessagingContact[]; nextCursor: string | null }>;
  countAudience(
    filter: AudienceFilter,
  ): Promise<{ total: number; withEmail: number; withPhone: number }>;
}

export const CONTACT_DIRECTORY = Symbol('MessagingContactDirectory');
