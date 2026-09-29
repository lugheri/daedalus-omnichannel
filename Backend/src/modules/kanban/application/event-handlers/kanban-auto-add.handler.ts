import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { ConversationStartedEvent } from '../../../conversations';
import { BOARD_CARD_REPOSITORY, type BoardCardRepository } from '../ports/board-card.repository';
import { BOARD_REPOSITORY, type BoardRepository } from '../ports/board.repository';
import { placeOnTop } from '../use-cases/cards.use-cases';

/**
 * Entrada automática: conversa nova entra no topo da primeira coluna dos
 * quadros que a aceitam (todas, ou as da equipe dela). Idempotente — evento
 * repetido não duplica o card.
 */
@Injectable()
export class KanbanAutoAddHandler {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  @HandlesDomainEvent(ConversationStartedEvent)
  async handle(event: DeliveredEvent<ConversationStartedEvent>): Promise<void> {
    const boards = await this.boards.listAcceptingNewConversations(event.teamId);
    for (const board of boards) {
      await this.unitOfWork.run(async () => {
        if (await this.cards.findOnBoard(board.id, event.aggregateId)) return;
        const card = await placeOnTop(this.cards, this.ids, {
          tenantId: event.tenantId,
          board,
          columnId: board.firstColumn.id,
          conversationId: event.aggregateId,
          by: null,
        });
        await this.events.publish(card.pullEvents());
      });
    }
  }
}
