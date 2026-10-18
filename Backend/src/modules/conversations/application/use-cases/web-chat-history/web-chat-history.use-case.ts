import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { MESSAGE_REPOSITORY, type MessageRepository } from '../../ports/message.repository';

/** Mensagem como o visitante do chat do site a vê. */
export interface WebChatHistoryItem {
  id: string;
  /** Mensagem do visitante: o id que o widget gerou (para não duplicar a que ele já mostra). */
  clientId: string | null;
  direction: 'inbound' | 'outbound';
  text: string;
  sentAt: Date;
}

const LIMIT = 100;

/**
 * O que o visitante do chat do site vê da conversa dele: só texto, só a
 * partir do começo da sessão dele no widget (quem digita o telefone de outra
 * pessoa não lê a conversa anterior dela), sem as que falharam. Mais antigas
 * primeiro.
 */
@Injectable()
export class WebChatHistoryUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
  ) {}

  async execute(input: {
    channelId: string;
    contactId: string;
    since: Date;
  }): Promise<WebChatHistoryItem[]> {
    const conversation = await this.conversations.findByChannelAndContact(
      input.channelId,
      input.contactId,
    );
    if (!conversation) return [];
    const { items } = await this.messages.listByConversation(conversation.id, { limit: LIMIT });
    return items
      .filter((m) => m.sentAt >= input.since && m.text && m.status !== 'failed')
      .reverse()
      .map((m) => ({
        id: m.id,
        clientId: m.direction === 'inbound' ? m.externalId : null,
        direction: m.direction,
        text: m.text ?? '',
        sentAt: m.sentAt,
      }));
  }
}
