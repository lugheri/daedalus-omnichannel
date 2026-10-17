/** O que o kanban precisa dos contatos (módulo contacts). Adapter em infra/. */
export interface DealContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface ContactDirectory {
  findById(id: string): Promise<DealContact | null>;
  findByIds(ids: string[]): Promise<DealContact[]>;
}

export const CONTACT_DIRECTORY = Symbol('KanbanContactDirectory');

/** Título padrão de um negócio novo: o nome do contato (ou o que houver). */
export function defaultDealTitle(contact: DealContact | null): string {
  return contact?.name?.trim() || contact?.phone || contact?.email || 'Negócio';
}
