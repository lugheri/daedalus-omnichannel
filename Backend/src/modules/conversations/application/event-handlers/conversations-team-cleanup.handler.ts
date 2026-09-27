import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { TeamDeletedEvent } from '../../../teams';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../ports/conversation.repository';

/** Equipe excluída: as conversas dela vão para a fila geral (responsáveis mantidos). */
@Injectable()
export class ConversationsTeamCleanupHandler {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
  ) {}

  @HandlesDomainEvent(TeamDeletedEvent)
  async handle(event: DeliveredEvent<TeamDeletedEvent>): Promise<void> {
    await this.conversations.clearTeam(event.aggregateId);
  }
}
