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
  ConversationDispositionSetEvent,
  ConversationMessageAddedEvent,
  ConversationMessageStatusChangedEvent,
  ConversationStatusChangedEvent,
  ConversationTeamChangedEvent,
} from '../../domain/events/conversation-events';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../ports/conversation.repository';

/** Nome do aviso no Socket.IO; o front invalida as telas da conversa. */
export const CONVERSATION_CHANGED = 'conversation.changed';

type Reason = 'message' | 'message-status' | 'status' | 'assignment' | 'team' | 'disposition';

/** Quem está com a conversa: responsável e equipe. */
interface Placement {
  assigneeId: string | null;
  teamId: string | null;
}

const VIEW_ALL = 'conversations:view:all';
const VIEW_TEAM = 'conversations:view:team';
const VIEW_OWN = 'conversations:view:own';

/**
 * Leva as mudanças de conversas às telas, em tempo real. O aviso é só um
 * sinal (`{ conversationId, reason }`); a tela busca os dados pela API.
 *
 * Vai só para quem pode ver a conversa — as salas espelham `visibility.ts`.
 * A audiência é calculada pela situação ATUAL da conversa (o evento pode ser
 * antigo) e, numa transferência, também pela ANTERIOR: quem perdeu a
 * conversa é avisado, e ela some da lista dele.
 */
@Injectable()
export class NotifyRealtimeHandler {
  constructor(
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifier,
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
  ) {}

  @HandlesDomainEvent(ConversationMessageAddedEvent)
  onMessage(event: DeliveredEvent<ConversationMessageAddedEvent>) {
    return this.notify(event, 'message');
  }

  @HandlesDomainEvent(ConversationMessageStatusChangedEvent)
  onMessageStatus(event: DeliveredEvent<ConversationMessageStatusChangedEvent>) {
    return this.notify(event, 'message-status');
  }

  @HandlesDomainEvent(ConversationStatusChangedEvent)
  onStatus(event: DeliveredEvent<ConversationStatusChangedEvent>) {
    return this.notify(event, 'status');
  }

  @HandlesDomainEvent(ConversationAssignedEvent)
  onAssigned(event: DeliveredEvent<ConversationAssignedEvent>) {
    return this.notify(event, 'assignment', (now) => ({
      ...now,
      assigneeId: event.previousAssigneeId,
    }));
  }

  @HandlesDomainEvent(ConversationTeamChangedEvent)
  onTeamChanged(event: DeliveredEvent<ConversationTeamChangedEvent>) {
    return this.notify(event, 'team', (now) => ({ ...now, teamId: event.previousTeamId }));
  }

  @HandlesDomainEvent(ConversationDispositionSetEvent)
  onDisposition(event: DeliveredEvent<ConversationDispositionSetEvent>) {
    return this.notify(event, 'disposition');
  }

  private async notify(
    event: { aggregateId: string; tenantId: string },
    reason: Reason,
    before?: (now: Placement) => Placement,
  ): Promise<void> {
    const conversation = await this.conversations.findById(event.aggregateId);
    const now: Placement = conversation
      ? { assigneeId: conversation.assigneeId, teamId: conversation.teamId }
      : { assigneeId: null, teamId: null };

    const rooms = new Set([
      ...audience(event.tenantId, now),
      ...(before ? audience(event.tenantId, before(now)) : []),
    ]);
    await this.notifier.emit([...rooms], CONVERSATION_CHANGED, {
      conversationId: event.aggregateId,
      reason,
    });
  }
}

/** Salas de quem vê uma conversa nesta situação (ver `isVisible`). */
export function audience(tenantId: string, { assigneeId, teamId }: Placement): string[] {
  const rooms = [RealtimeRooms.permission(tenantId, VIEW_ALL)];
  if (assigneeId) rooms.push(RealtimeRooms.member(assigneeId));

  if (teamId) {
    rooms.push(RealtimeRooms.teamPermission(teamId, VIEW_TEAM));
    if (!assigneeId) rooms.push(RealtimeRooms.teamPermission(teamId, VIEW_OWN));
  } else if (!assigneeId) {
    // Fila geral: todo mundo com escopo de conversa.
    rooms.push(
      RealtimeRooms.permission(tenantId, VIEW_OWN),
      RealtimeRooms.permission(tenantId, VIEW_TEAM),
    );
  }
  return rooms;
}
