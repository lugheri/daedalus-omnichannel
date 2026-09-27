import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  ConversationAssignedEvent,
  ConversationMessageAddedEvent,
  ConversationStatusChangedEvent,
} from './events/conversation-events';
import type { Message } from './message.entity';

export type ConversationStatus =
  | 'open' //     precisa de atenção do atendimento
  | 'pending' //  aguardando o cliente
  | 'resolved'; // encerrada (reabre sozinha se o cliente escrever)

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = ['open', 'pending', 'resolved'];

export interface ConversationProps {
  tenantId: string;
  channelId: string;
  contactId: string;
  status: ConversationStatus;
  assigneeId: string | null;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: Date;
}

/**
 * Conversa com um contato num canal — uma só por par (canal, contato), como
 * no próprio WhatsApp. Guarda o resumo que a caixa de entrada mostra (última
 * mensagem, não lidas); as mensagens são um agregado à parte.
 */
export class Conversation extends AggregateRoot<ConversationProps> {
  static start(
    id: string,
    input: { tenantId: string; channelId: string; contactId: string },
  ): Conversation {
    const now = new Date();
    return new Conversation(id, {
      ...input,
      status: 'open',
      assigneeId: null,
      lastMessageAt: now,
      lastMessagePreview: null,
      unreadCount: 0,
      createdAt: now,
    });
  }

  static restore(id: string, props: ConversationProps): Conversation {
    return new Conversation(id, props);
  }

  /**
   * Registra uma mensagem na conversa:
   * - do cliente: conta como não lida e reabre a conversa, se estava parada;
   * - nossa pelo sistema: zera as não lidas e, sem responsável, quem
   *   respondeu assume a conversa;
   * - nossa pelo celular: só atualiza o resumo.
   */
  addMessage(message: Message): void {
    if (message.sentAt >= this.props.lastMessageAt || this.props.lastMessagePreview === null) {
      this.props.lastMessageAt = message.sentAt;
      this.props.lastMessagePreview = message.preview;
    }

    if (message.direction === 'inbound') {
      this.props.unreadCount += 1;
      if (this.props.status !== 'open') this.changeStatus('open');
    } else if (message.senderMembershipId) {
      this.props.unreadCount = 0;
      if (!this.props.assigneeId) this.assign(message.senderMembershipId);
    }

    this.addEvent(
      new ConversationMessageAddedEvent(
        this.id,
        this.props.tenantId,
        message.id,
        message.direction,
        this.props.assigneeId,
      ),
    );
  }

  changeStatus(status: ConversationStatus): void {
    const previous = this.props.status;
    if (previous === status) return;
    this.props.status = status;
    this.addEvent(
      new ConversationStatusChangedEvent(this.id, this.props.tenantId, status, previous),
    );
  }

  assign(assigneeId: string | null): void {
    const previous = this.props.assigneeId;
    if (previous === assigneeId) return;
    this.props.assigneeId = assigneeId;
    this.addEvent(
      new ConversationAssignedEvent(this.id, this.props.tenantId, assigneeId, previous),
    );
  }

  markRead(): void {
    this.props.unreadCount = 0;
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get channelId() {
    return this.props.channelId;
  }
  get contactId() {
    return this.props.contactId;
  }
  get status() {
    return this.props.status;
  }
  get assigneeId() {
    return this.props.assigneeId;
  }
  get lastMessageAt() {
    return this.props.lastMessageAt;
  }
  get lastMessagePreview() {
    return this.props.lastMessagePreview;
  }
  get unreadCount() {
    return this.props.unreadCount;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}
