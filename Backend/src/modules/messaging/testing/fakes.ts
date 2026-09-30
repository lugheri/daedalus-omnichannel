import type { TenantContext } from '../../../shared/application/tenant-context';
import type { CampaignRepository } from '../application/ports/campaign.repository';
import type {
  AudienceFilter,
  ContactDirectory,
  MessagingContact,
} from '../application/ports/contact-directory';
import type { MessagingProviderRepository } from '../application/ports/messaging-provider.repository';
import type { OptOutRepository } from '../application/ports/opt-out.repository';
import type { OutboundMessageRepository } from '../application/ports/outbound-message.repository';
import type { UnsubscribeTarget, UnsubscribeTokens } from '../application/ports/unsubscribe-tokens';
import type { WebhookVerifier } from '../application/ports/webhook-verifier';
import type { OptOut } from '../domain/opt-out';
import { Campaign, type CampaignProps } from '../domain/campaign.entity';
import { OutboundMessage, type OutboundStatus } from '../domain/outbound-message.entity';
import type {
  EmailMessage,
  EmailProviderClient,
  ProviderClients,
  ProviderReceipt,
  SmsMessage,
  SmsProviderClient,
} from '../application/ports/provider-clients';
import {
  MessagingProvider,
  type EmailSettings,
  type MessagingChannel,
  type SmsSettings,
} from '../domain/messaging-provider.entity';

const copy = (p: MessagingProvider) =>
  MessagingProvider.restore(p.id, {
    tenantId: p.tenantId,
    channel: p.channel,
    settings: { ...p.settings },
    secret: { ...p.secret },
    status: p.status,
    lastCheckedAt: p.lastCheckedAt,
    lastError: p.lastError,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });

export class InMemoryMessagingProviderRepository implements MessagingProviderRepository {
  items: MessagingProvider[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((p) => p.tenantId === this.tenant.tenantId);
  }

  save(provider: MessagingProvider): Promise<void> {
    this.items = [...this.items.filter((p) => p.id !== provider.id), copy(provider)];
    return Promise.resolve();
  }

  findByChannel(channel: MessagingChannel): Promise<MessagingProvider | null> {
    const found = this.ofTenant().find((p) => p.channel === channel);
    return Promise.resolve(found ? copy(found) : null);
  }

  list(): Promise<MessagingProvider[]> {
    return Promise.resolve(this.ofTenant().map(copy));
  }

  delete(provider: MessagingProvider): Promise<void> {
    this.items = this.items.filter((p) => p.id !== provider.id);
    return Promise.resolve();
  }

  findByIdAsSystem(id: string): Promise<MessagingProvider | null> {
    const found = this.items.find((p) => p.id === id);
    return Promise.resolve(found ? copy(found) : null);
  }
}

/** Registra o que foi enviado (com qual segredo); `fail` simula a recusa/queda do provedor. */
export class FakeProviderClients implements ProviderClients {
  readonly emails: { settings: EmailSettings; secret: string; message: EmailMessage }[] = [];
  readonly sentSms: {
    settings: SmsSettings;
    secret: string;
    message: SmsMessage;
  }[] = [];
  fail: Error | null = null;

  email(): EmailProviderClient {
    return {
      send: (settings, secret, message): Promise<ProviderReceipt> => {
        if (this.fail) return Promise.reject(this.fail);
        this.emails.push({ settings, secret, message });
        return Promise.resolve({ providerMessageId: `sg-${this.emails.length}` });
      },
    };
  }

  sms(): SmsProviderClient {
    return {
      send: (settings, secret, message): Promise<ProviderReceipt> => {
        if (this.fail) return Promise.reject(this.fail);
        this.sentSms.push({ settings, secret, message });
        return Promise.resolve({ providerMessageId: `SM${this.sentSms.length}` });
      },
    };
  }
}

const copyMessage = (m: OutboundMessage) =>
  OutboundMessage.restore(m.id, {
    tenantId: m.tenantId,
    channel: m.channel,
    contactId: m.contactId,
    to: m.to,
    subject: m.subject,
    body: m.body,
    status: m.status,
    error: m.error,
    providerMessageId: m.providerMessageId,
    sentByMembershipId: m.sentByMembershipId,
    campaignId: m.campaignId,
    createdAt: m.createdAt,
    sentAt: m.sentAt,
    deliveredAt: m.deliveredAt,
    updatedAt: m.updatedAt,
  });

export class InMemoryOutboundMessageRepository implements OutboundMessageRepository {
  items: OutboundMessage[] = [];

  constructor(private readonly tenant: TenantContext) {}

  save(message: OutboundMessage): Promise<void> {
    this.items = [...this.items.filter((m) => m.id !== message.id), copyMessage(message)];
    return Promise.resolve();
  }

  findById(id: string): Promise<OutboundMessage | null> {
    const found = this.items.find((m) => m.id === id && m.tenantId === this.tenant.tenantId);
    return Promise.resolve(found ? copyMessage(found) : null);
  }

  listByContact(contactId: string, limit: number): Promise<OutboundMessage[]> {
    return Promise.resolve(
      this.items
        .filter((m) => m.contactId === contactId && m.tenantId === this.tenant.tenantId)
        .reverse()
        .slice(0, limit)
        .map(copyMessage),
    );
  }

  /** Como o banco: contato repetido na mesma campanha viola a unicidade. */
  saveMany(messages: OutboundMessage[]): Promise<void> {
    for (const m of messages) {
      if (
        m.campaignId &&
        this.items.some((x) => x.campaignId === m.campaignId && x.contactId === m.contactId)
      ) {
        return Promise.reject(new Error('unique violation (campaignId, contactId)'));
      }
    }
    this.items.push(...messages.map(copyMessage));
    return Promise.resolve();
  }

  contactsInCampaign(campaignId: string, contactIds: string[]): Promise<Set<string>> {
    return Promise.resolve(
      new Set(
        this.ofCampaign(campaignId)
          .map((m) => m.contactId)
          .filter((id) => contactIds.includes(id)),
      ),
    );
  }

  countByStatus(campaignId: string): Promise<Record<OutboundStatus, number>> {
    const counts: Record<OutboundStatus, number> = {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      bounced: 0,
    };
    for (const m of this.ofCampaign(campaignId)) counts[m.status] += 1;
    return Promise.resolve(counts);
  }

  listByCampaign(
    campaignId: string,
    { limit, status }: { cursor?: string; limit: number; status?: OutboundStatus },
  ) {
    return Promise.resolve({
      items: this.ofCampaign(campaignId)
        .filter((m) => !status || m.status === status)
        .slice(0, limit)
        .map(copyMessage),
      nextCursor: null,
    });
  }

  queuedIdsInCampaign(campaignId: string): Promise<string[]> {
    return Promise.resolve(
      this.ofCampaign(campaignId)
        .filter((m) => m.status === 'queued')
        .map((m) => m.id),
    );
  }

  private ofCampaign(campaignId: string) {
    return this.items.filter(
      (m) => m.campaignId === campaignId && m.tenantId === this.tenant.tenantId,
    );
  }
}

export class InMemoryOptOutRepository implements OptOutRepository {
  items: OptOut[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private has(channel: MessagingChannel, address: string) {
    return this.items.find(
      (o) => o.tenantId === this.tenant.tenantId && o.channel === channel && o.address === address,
    );
  }

  add(optOut: OptOut): Promise<void> {
    if (!this.has(optOut.channel, optOut.address)) {
      this.items.push({ ...optOut, tenantId: this.tenant.tenantId });
    }
    return Promise.resolve();
  }

  isOptedOut(channel: MessagingChannel, address: string): Promise<boolean> {
    return Promise.resolve(Boolean(this.has(channel, address)));
  }

  listFor(addresses: { channel: MessagingChannel; address: string }[]): Promise<OptOut[]> {
    return Promise.resolve(
      addresses.flatMap(({ channel, address }) => this.has(channel, address) ?? []),
    );
  }

  remove(channel: MessagingChannel, address: string): Promise<void> {
    this.items = this.items.filter((o) => o !== this.has(channel, address));
    return Promise.resolve();
  }
}

/** Contato de teste: além dos dados, a origem (para os filtros de público). */
export type FakeContact = MessagingContact & { source?: string; sourceDetail?: string };

export class FakeContactDirectory implements ContactDirectory {
  readonly contacts = new Map<string, FakeContact>();

  findById(id: string): Promise<MessagingContact | null> {
    return Promise.resolve(this.contacts.get(id) ?? null);
  }

  findByIds(ids: string[]): Promise<MessagingContact[]> {
    return Promise.resolve(ids.flatMap((id) => this.contacts.get(id) ?? []));
  }

  /** Por id crescente; o cursor é o último id da página anterior. */
  audiencePage(filter: AudienceFilter, { cursor, limit }: { cursor?: string; limit: number }) {
    const matching = this.matching(filter).filter((c) => !cursor || c.id > cursor);
    const items = matching.slice(0, limit);
    return Promise.resolve({
      items,
      nextCursor: matching.length > limit ? (items.at(-1)?.id ?? null) : null,
    });
  }

  countAudience(filter: AudienceFilter) {
    const found = this.matching(filter);
    return Promise.resolve({
      total: found.length,
      withEmail: found.filter((c) => c.email).length,
      withPhone: found.filter((c) => c.phone).length,
    });
  }

  private matching({ search, source, sourceDetail }: AudienceFilter): FakeContact[] {
    return [...this.contacts.values()]
      .filter((c) => !source || c.source === source)
      .filter((c) => !sourceDetail || c.sourceDetail?.toLowerCase() === sourceDetail.toLowerCase())
      .filter((c) => !search || c.name?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}

export class InMemoryCampaignRepository implements CampaignRepository {
  items: Campaign[] = [];

  constructor(private readonly tenant: TenantContext) {}

  save(campaign: Campaign): Promise<void> {
    const copy = Campaign.restore(campaign.id, {
      ...(campaign as unknown as { props: CampaignProps }).props,
    });
    this.items = [...this.items.filter((c) => c.id !== campaign.id), copy];
    return Promise.resolve();
  }

  findById(id: string): Promise<Campaign | null> {
    const found = this.items.find((c) => c.id === id && c.tenantId === this.tenant.tenantId);
    return Promise.resolve(
      found
        ? Campaign.restore(found.id, { ...(found as unknown as { props: CampaignProps }).props })
        : null,
    );
  }

  list({ limit }: { cursor?: string; limit: number }) {
    return Promise.resolve({
      items: this.items
        .filter((c) => c.tenantId === this.tenant.tenantId)
        .reverse()
        .slice(0, limit),
      nextCursor: null,
    });
  }

  delete(campaign: Campaign): Promise<void> {
    this.items = this.items.filter((c) => c.id !== campaign.id);
    return Promise.resolve();
  }

  listDueAllTenants(now: Date): Promise<{ id: string; tenantId: string }[]> {
    return Promise.resolve(
      this.items
        .filter((c) => c.status === 'scheduled' && c.scheduledAt && c.scheduledAt <= now)
        .map((c) => ({ id: c.id, tenantId: c.tenantId })),
    );
  }
}

/** Token legível: `unsub:<tenant>:<canal>:<endereço>` (a assinatura real é testada no infra). */
export class FakeUnsubscribeTokens implements UnsubscribeTokens {
  create(target: UnsubscribeTarget): string {
    return `unsub:${target.tenantId}:${target.channel}:${target.address}`;
  }

  verify(token: string): UnsubscribeTarget | null {
    const [prefix, tenantId, channel, address] = token.split(':');
    if (prefix !== 'unsub' || !tenantId || !address) return null;
    return { tenantId, channel: channel as MessagingChannel, address };
  }
}

/** Assinaturas "válidas" quando igual a `valid`; guarda o que recebeu para conferir. */
export class FakeWebhookVerifier implements WebhookVerifier {
  readonly twilioCalls: Parameters<WebhookVerifier['twilio']>[0][] = [];
  valid = 'good-signature';

  twilio(input: Parameters<WebhookVerifier['twilio']>[0]): boolean {
    this.twilioCalls.push(input);
    return input.signature === this.valid;
  }

  sendgrid(input: Parameters<WebhookVerifier['sendgrid']>[0]): boolean {
    return input.signature === this.valid;
  }
}
