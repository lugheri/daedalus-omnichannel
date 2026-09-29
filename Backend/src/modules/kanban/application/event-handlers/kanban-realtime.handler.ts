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
  BoardCardEnteredColumnEvent,
  BoardCardRemovedEvent,
  BoardCardRepositionedEvent,
  BoardChangedEvent,
} from '../../domain/events/kanban-events';

/** Nome do aviso no Socket.IO; o front recarrega o quadro. */
export const BOARD_CHANGED = 'board.changed';

/** Quem vê quadros: todo membro com algum escopo de conversas. */
const SCOPES = ['conversations:view:own', 'conversations:view:team', 'conversations:view:all'];

/**
 * Leva as mudanças dos quadros às telas. Só o sinal `{ boardId }`: a tela
 * busca os cards pela API, que filtra as conversas que cada um pode ver.
 */
@Injectable()
export class KanbanRealtimeHandler {
  constructor(@Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifier) {}

  @HandlesDomainEvent(BoardChangedEvent)
  onBoard(event: DeliveredEvent<BoardChangedEvent>) {
    return this.notify(event.tenantId, event.aggregateId);
  }

  @HandlesDomainEvent(BoardCardEnteredColumnEvent)
  onEntered(event: DeliveredEvent<BoardCardEnteredColumnEvent>) {
    return this.notify(event.tenantId, event.boardId);
  }

  @HandlesDomainEvent(BoardCardRepositionedEvent)
  onRepositioned(event: DeliveredEvent<BoardCardRepositionedEvent>) {
    return this.notify(event.tenantId, event.boardId);
  }

  @HandlesDomainEvent(BoardCardRemovedEvent)
  onRemoved(event: DeliveredEvent<BoardCardRemovedEvent>) {
    return this.notify(event.tenantId, event.boardId);
  }

  private notify(tenantId: string, boardId: string) {
    return this.notifier.emit(
      SCOPES.map((scope) => RealtimeRooms.permission(tenantId, scope)),
      BOARD_CHANGED,
      { boardId },
    );
  }
}
