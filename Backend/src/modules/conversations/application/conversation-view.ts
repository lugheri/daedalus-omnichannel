import type { Conversation } from '../domain/conversation.entity';
import type { ChannelGateway, ChannelInfo } from './ports/channel-gateway';
import type { ContactDirectory, ContactInfo } from './ports/contact-directory';
import type { TeamDirectory, TeamInfo } from './ports/team-directory';

/** Conversa com os dados de outros módulos que a tela precisa mostrar. */
export interface ConversationView {
  conversation: Conversation;
  /** null se o contato foi apagado. */
  contact: ContactInfo | null;
  /** null se o canal foi removido (a conversa continua como histórico). */
  channel: ChannelInfo | null;
  /** null se a conversa está na fila geral. */
  team: TeamInfo | null;
}

/** Junta contatos, canais e equipes de uma página inteira em três consultas (sem N+1). */
export async function toViews(
  conversations: Conversation[],
  contacts: ContactDirectory,
  channels: ChannelGateway,
  teams: TeamDirectory,
): Promise<ConversationView[]> {
  const teamIds = conversations.flatMap((c) => (c.teamId ? [c.teamId] : []));
  const [contactList, channelList, teamList] = await Promise.all([
    contacts.findByIds(conversations.map((c) => c.contactId)),
    channels.findByIds(conversations.map((c) => c.channelId)),
    teams.findByIds(teamIds),
  ]);
  const contactById = new Map(contactList.map((c) => [c.id, c]));
  const channelById = new Map(channelList.map((c) => [c.id, c]));
  const teamById = new Map(teamList.map((t) => [t.id, t]));

  return conversations.map((conversation) => ({
    conversation,
    contact: contactById.get(conversation.contactId) ?? null,
    channel: channelById.get(conversation.channelId) ?? null,
    team: conversation.teamId ? (teamById.get(conversation.teamId) ?? null) : null,
  }));
}
