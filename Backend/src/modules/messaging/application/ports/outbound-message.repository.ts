import type { OutboundMessage } from '../../domain/outbound-message.entity';

/** Mensagens enviadas (tenant atual). */
export interface OutboundMessageRepository {
  save(message: OutboundMessage): Promise<void>;
  findById(id: string): Promise<OutboundMessage | null>;
  /** Mais recentes primeiro. */
  listByContact(contactId: string, limit: number): Promise<OutboundMessage[]>;
}

export const OUTBOUND_MESSAGE_REPOSITORY = Symbol('OutboundMessageRepository');
