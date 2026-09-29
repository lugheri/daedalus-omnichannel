import type { TenantContext } from '../../../shared/application/tenant-context';
import type { ContactDirectory, MessagingContact } from '../application/ports/contact-directory';
import type { MessagingProviderRepository } from '../application/ports/messaging-provider.repository';
import type { OptOutRepository } from '../application/ports/opt-out.repository';
import type { OutboundMessageRepository } from '../application/ports/outbound-message.repository';
import type { UnsubscribeTarget, UnsubscribeTokens } from '../application/ports/unsubscribe-tokens';
import type { WebhookVerifier } from '../application/ports/webhook-verifier';
import type { OptOut } from '../domain/opt-out';
import { OutboundMessage } from '../domain/outbound-message.entity';
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

export class FakeContactDirectory implements ContactDirectory {
  readonly contacts = new Map<string, MessagingContact>();

  findById(id: string): Promise<MessagingContact | null> {
    return Promise.resolve(this.contacts.get(id) ?? null);
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
