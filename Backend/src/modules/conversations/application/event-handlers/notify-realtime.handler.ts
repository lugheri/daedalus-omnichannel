import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import {
  REALTIME_NOTIFIER,
  RealtimeRooms,
  type RealtimeNotifier,
} from '../../../../shared/application/realtime';
import {
  ConversationAssignedEvent,
  ConversationMessageAddedEvent,
  ConversationMessageStatusChangedEvent,
  ConversationStatusChangedEvent,
} from '../../domain/events/conversation-events';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../ports/conversation.repository';

/** Nome do aviso no Socket.IO; o front invalida as telas da conversa. */
export const CONVERSATION_CHANGED = 'conversation.changed';

type Reason = 'message' | 'message-status' | 'status' | 'assignment';

/**
 * Leva as mudanças de conversas às telas, em tempo real. O aviso é só um
 * sinal (`{ conversationId, reason }`); a tela busca os dados pela API.
 *
 * Vai só para quem pode ver a conversa — a mesma regra de `visibility.ts`:
 * quem tem `view:all`; o responsável; e, sem responsável, quem tem
 * `view:own`/`view:team` (a fila de onde eles puxam).
 */
@Injectable()
export class NotifyRealtimeHandler {
  constructor(
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifier,
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
  ) {}

  @HandlesDomainEvent(ConversationMessageAddedEvent)
  onMessage(event: DeliveredEvent<ConversationMessageAddedEvent>) {
    return this.notify(event, 'message', [event.assigneeId]);
  }

  @HandlesDomainEvent(ConversationMessageStatusChangedEvent)
  onMessageStatus(event: DeliveredEvent<ConversationMessageStatusChangedEvent>) {
    return this.notify(event, 'message-status');
  }

  @HandlesDomainEvent(ConversationStatusChangedEvent)
  onStatus(event: DeliveredEvent<ConversationStatusChangedEvent>) {
    return this.notify(event, 'status');
  }

  /** Avisa também quem deixou de ser responsável: a conversa some da lista dele. */
  @HandlesDomainEvent(ConversationAssignedEvent)
  onAssigned(event: DeliveredEvent<ConversationAssignedEvent>) {
    return this.notify(event, 'assignment', [event.assigneeId, event.previousAssigneeId]);
  }

  /**
   * Responsáveis a avisar. Sem lista, usa o responsável ATUAL (o evento pode
   * ser antigo: o que importa é quem vê a conversa agora).
   */
  private async notify(
    event: { aggregateId: string; tenantId: string },
    reason: Reason,
    assignees?: (string | null)[],
  ): Promise<void> {
    const targets = assignees ?? [
      (await this.conversations.findById(event.aggregateId))?.assigneeId ?? null,
    ];

    const room = (permission: string) => RealtimeRooms.permission(event.tenantId, permission);
    const rooms = new Set([room('conversations:view:all')]);
    for (const assignee of targets) {
      if (assignee) {
        rooms.add(RealtimeRooms.member(assignee));
      } else {
        rooms.add(room('conversations:view:own'));
        rooms.add(room('conversations:view:team'));
      }
    }
    await this.notifier.emit([...rooms], CONVERSATION_CHANGED, {
      conversationId: event.aggregateId,
      reason,
    });
  }
}
