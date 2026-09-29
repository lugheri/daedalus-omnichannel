import type { MessagingUrls } from '../application/ports/messaging-urls';
import { webhookPaths } from '../application/ports/messaging-urls';
import type { MessagingProvider } from '../domain/messaging-provider.entity';

/**
 * Formato público do provedor: nunca o segredo, só o final dele. Inclui os
 * endereços de webhook que o cliente precisa colar no painel do provedor.
 */
export const MessagingProviderPresenter = {
  toHttp: (provider: MessagingProvider, urls: MessagingUrls) => ({
    channel: provider.channel,
    settings: provider.settings,
    secretHint: provider.secret.hint,
    status: provider.status,
    lastCheckedAt: provider.lastCheckedAt?.toISOString() ?? null,
    lastError: provider.lastError,
    updatedAt: provider.updatedAt.toISOString(),
    webhooks: {
      /** Os provedores só alcançam endereços públicos (https). */
      reachable: urls.webhooksReachable,
      ...(provider.channel === 'email'
        ? { events: urls.publicApiUrl + webhookPaths.sendgridEvents(provider.id) }
        : { inbound: urls.publicApiUrl + webhookPaths.twilioInbound(provider.id) }),
    },
  }),
};
