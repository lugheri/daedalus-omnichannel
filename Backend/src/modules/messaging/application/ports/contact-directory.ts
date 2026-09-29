/** O que o messaging precisa dos contatos (módulo contacts). Adapter em infra/. */
export interface MessagingContact {
  id: string;
  name: string | null;
  email: string | null;
  /** E.164. */
  phone: string | null;
}

export interface ContactDirectory {
  findById(id: string): Promise<MessagingContact | null>;
}

export const CONTACT_DIRECTORY = Symbol('MessagingContactDirectory');
