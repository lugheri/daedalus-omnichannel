import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { TeamDeletedEvent } from '../../../teams';
import { BOARD_REPOSITORY, type BoardRepository } from '../ports/board.repository';

/** Equipe excluída: quadros que recebiam as conversas novas dela param de receber. */
@Injectable()
export class KanbanTeamCleanupHandler {
  constructor(@Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository) {}

  @HandlesDomainEvent(TeamDeletedEvent)
  async handle(event: DeliveredEvent<TeamDeletedEvent>): Promise<void> {
    await this.boards.clearAutoAddTeam(event.aggregateId);
  }
}
