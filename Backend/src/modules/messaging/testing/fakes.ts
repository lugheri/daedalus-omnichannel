import type { TenantContext } from '../../../shared/application/tenant-context';
import type { MessagingProviderRepository } from '../application/ports/messaging-provider.repository';
import type {
  EmailMessage,
  EmailProviderClient,
  ProviderClients,
  ProviderReceipt,
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
}

/** Registra o que foi enviado (com qual segredo); `fail` simula a recusa/queda do provedor. */
export class FakeProviderClients implements ProviderClients {
  readonly emails: { settings: EmailSettings; secret: string; message: EmailMessage }[] = [];
  readonly sentSms: {
    settings: SmsSettings;
    secret: string;
    message: { to: string; body: string };
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
