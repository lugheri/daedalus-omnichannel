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
  BoardChangedEvent,
  DealChangedEvent,
  DealClosedEvent,
  DealEnteredColumnEvent,
} from '../../domain/events/kanban-events';

/** Nome do aviso no Socket.IO; o front recarrega o funil e os negócios do contato. */
export const BOARD_CHANGED = 'board.changed';

/** Quem vê funis: todo membro com algum escopo de conversas. */
const SCOPES = ['conversations:view:own', 'conversations:view:team', 'conversations:view:all'];

/**
 * Leva as mudanças dos funis às telas. Só o sinal `{ boardId, contactId? }`:
 * a tela busca os negócios pela API, que filtra o que cada um pode ver.
 */
@Injectable()
export class KanbanRealtimeHandler {
  constructor(@Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifier) {}

  @HandlesDomainEvent(BoardChangedEvent)
  onBoard(event: DeliveredEvent<BoardChangedEvent>) {
    return this.notify(event.tenantId, event.aggregateId);
  }

  @HandlesDomainEvent(DealEnteredColumnEvent)
  onEntered(event: DeliveredEvent<DealEnteredColumnEvent>) {
    return this.notify(event.tenantId, event.boardId, event.contactId);
  }

  @HandlesDomainEvent(DealChangedEvent)
  onChanged(event: DeliveredEvent<DealChangedEvent>) {
    return this.notify(event.tenantId, event.boardId, event.contactId);
  }

  @HandlesDomainEvent(DealClosedEvent)
  onClosed(event: DeliveredEvent<DealClosedEvent>) {
    return this.notify(event.tenantId, event.boardId, event.contactId);
  }

  private notify(tenantId: string, boardId: string, contactId?: string) {
    return this.notifier.emit(
      SCOPES.map((scope) => RealtimeRooms.permission(tenantId, scope)),
      BOARD_CHANGED,
      { boardId, contactId },
    );
  }
}
