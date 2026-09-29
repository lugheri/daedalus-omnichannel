import type { MessagingProvider } from '../domain/messaging-provider.entity';

/** Formato público do provedor: nunca o segredo, só o final dele. */
export const MessagingProviderPresenter = {
  toHttp: (provider: MessagingProvider) => ({
    channel: provider.channel,
    settings: provider.settings,
    secretHint: provider.secret.hint,
    status: provider.status,
    lastCheckedAt: provider.lastCheckedAt?.toISOString() ?? null,
    lastError: provider.lastError,
    updatedAt: provider.updatedAt.toISOString(),
  }),
};
