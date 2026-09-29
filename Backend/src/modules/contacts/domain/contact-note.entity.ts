import { Entity } from '../../../shared/domain/entity';
import { InvalidNoteError } from './errors/invalid-note.error';
import { NoteNotYoursError } from './errors/note-not-yours.error';

export interface ContactNoteProps {
  tenantId: string;
  contactId: string;
  /** Vínculo (membership) de quem escreveu. */
  authorMembershipId: string;
  body: string;
  createdAt: Date;
}

const MAX_BODY = 5000;

/** Nota interna da equipe sobre um contato — o cliente nunca a vê. */
export class ContactNote extends Entity<ContactNoteProps> {
  static create(id: string, input: Omit<ContactNoteProps, 'createdAt'>): ContactNote {
    const body = input.body.trim();
    if (body.length < 1 || body.length > MAX_BODY) throw new InvalidNoteError();
    return new ContactNote(id, { ...input, body, createdAt: new Date() });
  }

  static restore(id: string, props: ContactNoteProps): ContactNote {
    return new ContactNote(id, props);
  }

  /** Só quem escreveu apaga a própria nota (o histórico da equipe não some). */
  assertCanDelete(membershipId: string): void {
    if (this.props.authorMembershipId !== membershipId) throw new NoteNotYoursError();
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get contactId() {
    return this.props.contactId;
  }
  get authorMembershipId() {
    return this.props.authorMembershipId;
  }
  get body() {
    return this.props.body;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}
