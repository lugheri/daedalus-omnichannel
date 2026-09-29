import { Inject, Injectable } from '@nestjs/common';
import type { ConversationStatus } from '../domain/conversation.entity';
import { isVisible } from '../domain/visibility';
import { toViews } from './conversation-view';
import { CHANNEL_GATEWAY, type ChannelGateway } from './ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from './ports/contact-directory';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from './ports/conversation.repository';
import { TEAM_DIRECTORY, type TeamDirectory } from './ports/team-directory';
import { VisibleConversations } from './visible-conversations';

/** Resumo de uma conversa para outros módulos (ex.: o card do kanban). */
export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  assigneeId: string | null;
  dispositionId: string | null;
  unreadCount: number;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  contact: { id: string; name: string | null; phone: string | null };
  channel: { id: string; name: string | null };
  team: { id: string; name: string } | null;
}

/**
 * API síncrona do módulo para outros módulos. Tudo aqui respeita o escopo do
 * membro da requisição: o que ele não vê na caixa de entrada não sai daqui.
 */
@Injectable()
export class ConversationsFacade {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
    private readonly visible: VisibleConversations,
  ) {}

  /** Das conversas informadas, as que o membro atual vê (na ordem dos ids). */
  async visibleSummaries(ids: string[]): Promise<ConversationSummary[]> {
    if (ids.length === 0) return [];
    const { scope } = await this.visible.scope();
    const found = (await this.conversations.findByIds(ids)).filter((c) => isVisible(c, scope));
    const views = await toViews(found, this.contacts, this.channels, this.teams);
    const byId = new Map(
      views.map(({ conversation: c, contact, channel, team }) => [
        c.id,
        {
          id: c.id,
          status: c.status,
          assigneeId: c.assigneeId,
          dispositionId: c.dispositionId,
          unreadCount: c.unreadCount,
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: c.lastMessagePreview,
          contact: contact
            ? { id: contact.id, name: contact.name, phone: contact.phone }
            : { id: c.contactId, name: null, phone: null },
          channel: channel
            ? { id: channel.id, name: channel.name }
            : { id: c.channelId, name: null },
          team,
        } satisfies ConversationSummary,
      ]),
    );
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** O membro atual vê esta conversa? (inexistente = não) */
  async isVisible(id: string): Promise<boolean> {
    const { scope } = await this.visible.scope();
    const conversation = await this.conversations.findById(id);
    return conversation !== null && isVisible(conversation, scope);
  }
}
