import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { TeamDeletedEvent } from '../../../teams';
import { CHANNEL_REPOSITORY, type ChannelRepository } from '../ports/channel.repository';

/** Equipe excluída: os canais dela passam a mandar as conversas para a fila geral. */
@Injectable()
export class ChannelsTeamCleanupHandler {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository) {}

  @HandlesDomainEvent(TeamDeletedEvent)
  async handle(event: DeliveredEvent<TeamDeletedEvent>): Promise<void> {
    await this.channels.clearTeam(event.aggregateId);
  }
}
