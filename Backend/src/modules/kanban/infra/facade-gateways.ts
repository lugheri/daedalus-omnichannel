import { Injectable } from '@nestjs/common';
import { AccountsFacade } from '../../accounts';
import { ConversationsFacade } from '../../conversations';
import { TeamsFacade } from '../../teams';
import type {
  CardConversation,
  ConversationDirectory,
} from '../application/ports/conversation-directory';
import type { ConversationActions } from '../application/ports/conversation-actions';
import type { MemberDirectory } from '../application/ports/member-directory';
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

/** Ações de sistema das automações (sem membro: só o tenant limita). */
@Injectable()
export class ConversationsFacadeActions implements ConversationActions {
  constructor(private readonly conversations: ConversationsFacade) {}

  async contactName(conversationId: string): Promise<string | null> {
    return (await this.conversations.summaryAsSystem(conversationId))?.contact.name ?? null;
  }

  sendAutomatedMessage(conversationId: string, text: string): Promise<void> {
    return this.conversations.sendAutomatedMessageAsSystem(conversationId, text);
  }

  assign(
    conversationId: string,
    input: { teamId?: string | null; assigneeId?: string | null },
  ): Promise<void> {
    return this.conversations.assignAsSystem(conversationId, input);
  }

  dispositionExists(dispositionId: string): Promise<boolean> {
    return this.conversations.dispositionExists(dispositionId);
  }
}

@Injectable()
export class AccountsFacadeMembers implements MemberDirectory {
  constructor(private readonly accounts: AccountsFacade) {}

  async isActive(membershipId: string): Promise<boolean> {
    return (await this.accounts.activeMemberIds([membershipId])).length > 0;
  }
}
