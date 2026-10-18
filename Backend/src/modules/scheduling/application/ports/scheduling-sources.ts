/** O que a agenda usa de outros módulos (catalog, contacts, accounts), pelas facades. */

export interface AgendaService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number | null;
  showOnSite: boolean;
  active: boolean;
}

export interface AgendaProfessional {
  id: string;
  name: string;
  offeringIds: string[];
  showOnSite: boolean;
  active: boolean;
}

export interface SchedulingCatalog {
  /** Serviços e profissionais da conta atual (inclusive os inativos). */
  load(): Promise<{ services: AgendaService[]; professionals: AgendaProfessional[] }>;
}

export const SCHEDULING_CATALOG = Symbol('SchedulingCatalog');

export interface SchedulingContacts {
  findByIds(ids: string[]): Promise<{ id: string; name: string | null; phone: string | null }[]>;
  /** Quem marcou pelo site: o contato existente ou um novo (origem "Agendamento pelo site"). */
  captureBookingLead(input: {
    name: string;
    phone: string | null;
    email: string | null;
  }): Promise<{ contactId: string }>;
}

export const SCHEDULING_CONTACTS = Symbol('SchedulingContacts');

/** O membro da requisição (quem marcou pelo painel). */
export interface SchedulingMembers {
  currentMembershipId(): Promise<string>;
}

export const SCHEDULING_MEMBERS = Symbol('SchedulingMembers');

/** Chave pública aleatória do widget de agendamento. */
export interface BookingKeyGenerator {
  generate(): string;
}

export const BOOKING_KEY_GENERATOR = Symbol('BookingKeyGenerator');
