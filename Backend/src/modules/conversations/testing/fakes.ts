import type { CursorPage, PageRequest } from '../../../shared/application/pagination';
import type { TenantContext } from '../../../shared/application/tenant-context';
import type { ChannelGateway, ChannelInfo } from '../application/ports/channel-gateway';
import type { ContactDirectory, ContactInfo } from '../application/ports/contact-directory';
import type {
  ConversationListQuery,
  ConversationRepository,
} from '../application/ports/conversation.repository';
import type { CurrentMember, MemberAccess } from '../application/ports/member-access';
import type { MessageRepository } from '../application/ports/message.repository';
import type { Conversation } from '../domain/conversation.entity';
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

  list({ scope, status, limit }: ConversationListQuery): Promise<CursorPage<Conversation>> {
    const items = this.ofTenant()
      .filter((c) => (!status || c.status === status) && isVisible(c, scope))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    return Promise.resolve({ items: items.slice(0, limit), nextCursor: null });
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

  findByIds(ids: string[]): Promise<ChannelInfo[]> {
    return Promise.resolve(ids.map((id) => ({ id, name: `Canal ${id}` })));
  }

  assertCanSend(): Promise<void> {
    if (!this.connected) return Promise.reject(new Error('CHANNEL_NOT_CONNECTED'));
    return Promise.resolve();
  }

  sendText(input: { channelId: string; messageId: string; to: string; text: string }) {
    if (this.failEnqueue) return Promise.reject(new Error('queue down'));
    this.sent.push(input);
    return Promise.resolve();
  }
}

export class FakeMemberAccess implements MemberAccess {
  constructor(public member: CurrentMember) {}

  current(): Promise<CurrentMember> {
    return Promise.resolve(this.member);
  }
}
