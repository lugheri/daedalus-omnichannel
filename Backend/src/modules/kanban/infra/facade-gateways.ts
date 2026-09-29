import { Injectable } from '@nestjs/common';
import { ConversationsFacade } from '../../conversations';
import { TeamsFacade } from '../../teams';
import type {
  CardConversation,
  ConversationDirectory,
} from '../application/ports/conversation-directory';
import type { TeamDirectory } from '../application/ports/team-directory';

/** Adapters dos ports do kanban sobre as APIs públicas dos outros módulos. */

@Injectable()
export class ConversationsFacadeDirectory implements ConversationDirectory {
  constructor(private readonly conversations: ConversationsFacade) {}

  visible(ids: string[]): Promise<CardConversation[]> {
    return this.conversations.visibleSummaries(ids);
  }

  isVisible(id: string): Promise<boolean> {
    return this.conversations.isVisible(id);
  }
}

@Injectable()
export class TeamsFacadeDirectory implements TeamDirectory {
  constructor(private readonly teams: TeamsFacade) {}

  exists(teamId: string): Promise<boolean> {
    return this.teams.exists(teamId);
  }
}
