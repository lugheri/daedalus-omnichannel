/**
 * O que conversations precisa do módulo contacts, nos termos de conversations.
 * Adapter em infra/ sobre a ContactsFacade.
 */
export interface ContactInfo {
  id: string;
  name: string | null;
  phone: string | null;
}

export interface ContactDirectory {
  findById(id: string): Promise<ContactInfo | null>;
  findByIds(ids: string[]): Promise<ContactInfo[]>;
  /** O contato deste telefone, criado se ainda não existir. */
  findOrCreateByPhone(input: { phone: string; name: string | null }): Promise<ContactInfo>;
}

export const CONTACT_DIRECTORY = Symbol('ContactDirectory');
