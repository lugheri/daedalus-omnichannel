import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage } from '../../../../../shared/application/pagination';
import type { ConversationStatus } from '../../../domain/conversation.entity';
import { toViews, type ConversationView } from '../../conversation-view';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { TEAM_DIRECTORY, type TeamDirectory } from '../../ports/team-directory';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../../ports/contact-directory';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { VisibleConversations } from '../../visible-conversations';

/** Caixa de entrada: conversas no escopo do membro, mais recentes primeiro. */
@Injectable()
export class ListConversationsUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(input: {
    status?: ConversationStatus;
    assignee?: 'me' | 'none';
    limit: number;
    cursor?: string;
  }): Promise<CursorPage<ConversationView>> {
    const { scope, member } = await this.visible.scope();
    const page = await this.conversations.list({ ...input, scope, me: member.membershipId });
    return {
      items: await toViews(page.items, this.contacts, this.channels, this.teams),
      nextCursor: page.nextCursor,
    };
  }
}
