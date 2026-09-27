import { DomainEvent } from '../../../../shared/domain/domain-event';
import type { ConversationStatus } from '../conversation.entity';
import type { MessageDirection, MessageStatus } from '../message.entity';

/**
 * Eventos públicos do módulo conversations (exportados no index.ts). O tempo
 * real (Socket.IO) os repassa às telas; relatórios e auditoria podem consumi-los.
 */

/** Mensagem nova numa conversa (recebida, enviada por nós ou pelo celular). */
export class ConversationMessageAddedEvent extends DomainEvent {
  static readonly eventName = 'conversation.message.added.v1';
  readonly eventName = ConversationMessageAddedEvent.eventName;

  constructor(
    conversationId: string,
    readonly tenantId: string,
    readonly messageId: string,
    readonly direction: MessageDirection,
    /** Responsável pela conversa no momento (para avisar só quem interessa). */
    readonly assigneeId: string | null,
  ) {
    super(conversationId);
  }
}

/** Envio confirmado ou recusado pelo canal. */
export class ConversationMessageStatusChangedEvent extends DomainEvent {
  static readonly eventName = 'conversation.message.status-changed.v1';
  readonly eventName = ConversationMessageStatusChangedEvent.eventName;

  constructor(
    conversationId: string,
    readonly tenantId: string,
    readonly messageId: string,
    readonly status: MessageStatus,
  ) {
    super(conversationId);
  }
}

export class ConversationStatusChangedEvent extends DomainEvent {
  static readonly eventName = 'conversation.status-changed.v1';
  readonly eventName = ConversationStatusChangedEvent.eventName;

  constructor(
    conversationId: string,
    readonly tenantId: string,
    readonly status: ConversationStatus,
    readonly previousStatus: ConversationStatus,
  ) {
    super(conversationId);
  }
}

export class ConversationAssignedEvent extends DomainEvent {
  static readonly eventName = 'conversation.assigned.v1';
  readonly eventName = ConversationAssignedEvent.eventName;

  constructor(
    conversationId: string,
    readonly tenantId: string,
    readonly assigneeId: string | null,
    readonly previousAssigneeId: string | null,
  ) {
    super(conversationId);
  }
}
