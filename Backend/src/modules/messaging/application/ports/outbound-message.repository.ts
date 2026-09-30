import type { OutboundMessage, OutboundStatus } from '../../domain/outbound-message.entity';

/** Mensagens enviadas (tenant atual). */
export interface OutboundMessageRepository {
  save(message: OutboundMessage): Promise<void>;
  findById(id: string): Promise<OutboundMessage | null>;
  /** Mais recentes primeiro. */
  listByContact(contactId: string, limit: number): Promise<OutboundMessage[]>;
  /** Lote de mensagens novas de uma campanha (numa só ida ao banco). */
  saveMany(messages: OutboundMessage[]): Promise<void>;
  /** Dos contatos informados, os que já têm mensagem nesta campanha (montagem retomada). */
  contactsInCampaign(campaignId: string, contactIds: string[]): Promise<Set<string>>;
  countByStatus(campaignId: string): Promise<Record<OutboundStatus, number>>;
  /** Destinatários da campanha, por id (cursor), filtrando por status se pedido. */
  listByCampaign(
    campaignId: string,
    page: { cursor?: string; limit: number; status?: OutboundStatus },
  ): Promise<{ items: OutboundMessage[]; nextCursor: string | null }>;
  /** Ids das mensagens ainda na fila (para reenfileirar ao retomar). */
  queuedIdsInCampaign(campaignId: string): Promise<string[]>;
}

export const OUTBOUND_MESSAGE_REPOSITORY = Symbol('OutboundMessageRepository');
