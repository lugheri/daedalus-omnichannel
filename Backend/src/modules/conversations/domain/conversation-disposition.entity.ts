import { Entity } from '../../../shared/domain/entity';
import { InvalidDispositionNoteError } from './errors/invalid-disposition-note.error';

export const DISPOSITION_NOTE_MAX = 1000;

export interface ConversationDispositionProps {
  tenantId: string;
  conversationId: string;
  dispositionId: string;
  /** Observação de quem tabulou (opcional). */
  note: string | null;
  /** Vínculo (membership) de quem tabulou. */
  membershipId: string;
  createdAt: Date;
}

/**
 * Registro de uma tabulação num atendimento. Nunca é alterado nem apagado:
 * o histórico mostra cada classificação, com quem, quando e a observação.
 */
export class ConversationDisposition extends Entity<ConversationDispositionProps> {
  static record(
    id: string,
    input: Omit<ConversationDispositionProps, 'createdAt' | 'note'> & { note?: string | null },
  ): ConversationDisposition {
    const note = input.note?.trim() || null;
    if (note && note.length > DISPOSITION_NOTE_MAX) throw new InvalidDispositionNoteError();
    return new ConversationDisposition(id, { ...input, note, createdAt: new Date() });
  }

  static restore(id: string, props: ConversationDispositionProps): ConversationDisposition {
    return new ConversationDisposition(id, props);
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get conversationId() {
    return this.props.conversationId;
  }
  get dispositionId() {
    return this.props.dispositionId;
  }
  get note() {
    return this.props.note;
  }
  get membershipId() {
    return this.props.membershipId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}
