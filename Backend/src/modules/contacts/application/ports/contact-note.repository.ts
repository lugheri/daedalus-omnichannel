import type { ContactNote } from '../../domain/contact-note.entity';

/** Notas de contato; tudo restrito ao tenant da operação atual. */
export interface ContactNoteRepository {
  save(note: ContactNote): Promise<void>;
  findById(id: string): Promise<ContactNote | null>;
  /** Mais recentes primeiro. */
  listByContact(contactId: string): Promise<ContactNote[]>;
  delete(note: ContactNote): Promise<void>;
}

export const CONTACT_NOTE_REPOSITORY = Symbol('ContactNoteRepository');
