import type { CursorPage, PageRequest } from '../../../shared/application/pagination';
import type { TenantContext } from '../../../shared/application/tenant-context';
import type { ChannelGateway, ChannelInfo } from '../application/ports/channel-gateway';
import type { ContactDirectory, ContactInfo } from '../application/ports/contact-directory';
import type { ConversationDispositionRepository } from '../application/ports/conversation-disposition.repository';
import type { DispositionRepository } from '../application/ports/disposition.repository';
import type {
  ConversationListQuery,
  ConversationRepository,
} from '../application/ports/conversation.repository';
import type { CurrentMember, MemberAccess } from '../application/ports/member-access';
import type { MessageRepository } from '../application/ports/message.repository';
import type { TeamDirectory, TeamInfo } from '../application/ports/team-directory';
import type { Conversation } from '../domain/conversation.entity';
import type { ConversationDisposition } from '../domain/conversation-disposition.entity';
import type { Disposition } from '../domain/disposition.entity';
import type { Message } from '../domain/message.entity';
import { isVisible } from '../domain/visibility';

/** Reproduz o repositório real: isolado por tenant, escopo e ordem da caixa de entrada. */
export class InMemoryConversationRepository implements ConversationRepository {
  private items: Conversation[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((c) => c.tenantId === this.tenant.tenantId);
  }

  save(conversation: Conversation): Promise<void> {
    this.items = [...this.items.filter((c) => c.id !== conversation.id), conversation];
    return Promise.resolve();
  }

  findById(id: string): Promise<Conversation | null> {
    return Promise.resolve(this.ofTenant().find((c) => c.id === id) ?? null);
  }

  findByChannelAndContact(channelId: string, contactId: string): Promise<Conversation | null> {
    return Promise.resolve(
      this.ofTenant().find((c) => c.channelId === channelId && c.contactId === contactId) ?? null,
    );
  }

  list({
    scope,
    status,
    assignee,
    contactId,
    me,
    limit,
  }: ConversationListQuery): Promise<CursorPage<Conversation>> {
    const items = this.ofTenant()
      .filter((c) => (!status || c.status === status) && isVisible(c, scope))
      .filter((c) => !contactId || c.contactId === contactId)
      .filter((c) =>
        assignee === 'me' ? c.assigneeId === me : assignee === 'none' ? !c.assigneeId : true,
      )
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    return Promise.resolve({ items: items.slice(0, limit), nextCursor: null });
  }

  clearTeam(teamId: string): Promise<void> {
    for (const c of this.ofTenant()) if (c.teamId === teamId) c.moveToTeam(null);
    return Promise.resolve();
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  readonly items: Message[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((m) => m.tenantId === this.tenant.tenantId);
  }

  save(message: Message): Promise<void> {
    const index = this.items.findIndex((m) => m.id === message.id);
    if (index >= 0) this.items[index] = message;
    else this.items.push(message);
    return Promise.resolve();
  }

  findById(id: string): Promise<Message | null> {
    return Promise.resolve(this.ofTenant().find((m) => m.id === id) ?? null);
  }

  existsByExternalId(channelId: string, externalId: string): Promise<boolean> {
    return Promise.resolve(
      this.ofTenant().some((m) => m.channelId === channelId && m.externalId === externalId),
    );
  }

  listByConversation(conversationId: string, { limit }: PageRequest) {
    const items = this.ofTenant()
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit);
    return Promise.resolve({ items, nextCursor: null });
  }
}

/** Contatos por tenant, criados sob demanda como a ContactsFacade faz. */
export class FakeContactDirectory implements ContactDirectory {
  private readonly contacts: (ContactInfo & { tenantId: string })[] = [];
  private seq = 0;

  constructor(private readonly tenant: TenantContext) {}

  findById(id: string): Promise<ContactInfo | null> {
    return Promise.resolve(this.mine().find((c) => c.id === id) ?? null);
  }

  findByIds(ids: string[]): Promise<ContactInfo[]> {
    return Promise.resolve(this.mine().filter((c) => ids.includes(c.id)));
  }

  findOrCreateByPhone(input: { phone: string; name: string | null }): Promise<ContactInfo> {
    const existing = this.mine().find((c) => c.phone === input.phone);
    if (existing) return Promise.resolve(existing);
    const contact = { id: `contact-${++this.seq}`, tenantId: this.tenant.tenantId, ...input };
    this.contacts.push(contact);
    return Promise.resolve(contact);
  }

  private mine() {
    return this.contacts.filter((c) => c.tenantId === this.tenant.tenantId);
  }
}

export class FakeChannelGateway implements ChannelGateway {
  readonly sent: { channelId: string; messageId: string; to: string; text: string }[] = [];
  connected = true;
  failEnqueue = false;
  /** Equipe de cada canal (o resto fica na fila geral). */
  readonly teams = new Map<string, string>();

  findByIds(ids: string[]): Promise<ChannelInfo[]> {
    return Promise.resolve(
      ids.map((id) => ({ id, name: `Canal ${id}`, teamId: this.teams.get(id) ?? null })),
    );
  }

  assertCanSend(): Promise<void> {
    if (!this.connected) return Promise.reject(new Error('CHANNEL_NOT_CONNECTED'));
    return Promise.resolve();
  }

  readonly sentMedia: Parameters<ChannelGateway['sendMedia']>[0][] = [];

  sendMedia(input: Parameters<ChannelGateway['sendMedia']>[0]) {
    if (this.failEnqueue) return Promise.reject(new Error('queue down'));
    this.sentMedia.push(input);
    return Promise.resolve();
  }

  sendText(input: { channelId: string; messageId: string; to: string; text: string }) {
    if (this.failEnqueue) return Promise.reject(new Error('queue down'));
    this.sent.push(input);
    return Promise.resolve();
  }
}

export class FakeMemberAccess implements MemberAccess {
  /** Membros ativos da conta (para validar transferências). */
  readonly active = new Set<string>();

  constructor(public member: CurrentMember) {}

  current(): Promise<CurrentMember> {
    return Promise.resolve(this.member);
  }

  activeMemberIds(ids: string[]): Promise<string[]> {
    return Promise.resolve(ids.filter((id) => this.active.has(id)));
  }
}

export class FakeTeamDirectory implements TeamDirectory {
  constructor(private readonly teams: TeamInfo[] = []) {}

  findByIds(ids: string[]): Promise<TeamInfo[]> {
    return Promise.resolve(this.teams.filter((t) => ids.includes(t.id)));
  }

  exists(teamId: string): Promise<boolean> {
    return Promise.resolve(this.teams.some((t) => t.id === teamId));
  }
}

export class InMemoryConversationDispositionRepository implements ConversationDispositionRepository {
  readonly items: ConversationDisposition[] = [];

  constructor(private readonly tenant: TenantContext) {}

  save(record: ConversationDisposition): Promise<void> {
    this.items.push(record);
    return Promise.resolve();
  }

  listByConversation(conversationId: string): Promise<ConversationDisposition[]> {
    return Promise.resolve(
      this.items
        .filter((r) => r.tenantId === this.tenant.tenantId && r.conversationId === conversationId)
        .reverse(),
    );
  }
}

/** "Usada" = aparece no histórico informado (como a FK do banco). */
export class InMemoryDispositionRepository implements DispositionRepository {
  private items: Disposition[] = [];

  constructor(
    private readonly tenant: TenantContext,
    private readonly history: InMemoryConversationDispositionRepository,
  ) {}

  private ofTenant() {
    return this.items.filter((d) => d.tenantId === this.tenant.tenantId);
  }

  save(disposition: Disposition): Promise<void> {
    this.items = [...this.items.filter((d) => d.id !== disposition.id), disposition];
    return Promise.resolve();
  }

  findById(id: string): Promise<Disposition | null> {
    return Promise.resolve(this.ofTenant().find((d) => d.id === id) ?? null);
  }

  findByName(name: string): Promise<Disposition | null> {
    const lower = name.toLowerCase();
    return Promise.resolve(this.ofTenant().find((d) => d.name.toLowerCase() === lower) ?? null);
  }

  list(): Promise<Disposition[]> {
    return Promise.resolve([...this.ofTenant()].sort((a, b) => a.name.localeCompare(b.name)));
  }

  hasActive(): Promise<boolean> {
    return Promise.resolve(this.ofTenant().some((d) => d.isActive));
  }

  isUsed(id: string): Promise<boolean> {
    return Promise.resolve(
      this.history.items.some((r) => r.tenantId === this.tenant.tenantId && r.dispositionId === id),
    );
  }

  delete(id: string): Promise<void> {
    this.items = this.items.filter((d) => !(d.id === id && d.tenantId === this.tenant.tenantId));
    return Promise.resolve();
  }
}
