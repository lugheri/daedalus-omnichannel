import { Inject, Injectable, Logger } from '@nestjs/common';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { SECRET_CIPHER, type SecretCipher } from '../../../../shared/application/secret-cipher';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { normalizePhoneNumber } from '../../../../shared/domain/phone-number';
import type { MessagingProvider } from '../../domain/messaging-provider.entity';
import { normalizeEmail } from '../../domain/messaging-provider.entity';
import { isSmsOptOutReply } from '../../domain/opt-out';
import { InboundSmsJob, ProviderEventsJob, type ProviderEvent } from '../messaging-jobs';
import {
  MESSAGING_PROVIDER_REPOSITORY,
  type MessagingProviderRepository,
} from '../ports/messaging-provider.repository';
import { MESSAGING_URLS, type MessagingUrls } from '../ports/messaging-urls';
import { OPT_OUT_REPOSITORY, type OptOutRepository } from '../ports/opt-out.repository';
import {
  OUTBOUND_MESSAGE_REPOSITORY,
  type OutboundMessageRepository,
} from '../ports/outbound-message.repository';
import { WEBHOOK_VERIFIER, type WebhookVerifier } from '../ports/webhook-verifier';

/** Webhook recusado: assinatura inválida ou provedor inexistente (a rota responde 401). */
export class WebhookRejected extends Error {}

/**
 * Webhooks dos provedores (sem sessão). Cada um: acha o provedor pelo id da
 * URL, confere a assinatura com as credenciais DELE, entra no tenant dele e
 * enfileira — responde rápido; o processamento é no worker.
 */
@Injectable()
export class AcceptProviderWebhookUseCase {
  constructor(
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
    @Inject(WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(MESSAGING_URLS) private readonly urls: MessagingUrls,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  /** Status de um SMS (StatusCallback, com o nosso id em `?m=`). */
  async twilioStatus(input: {
    providerId: string;
    /** Caminho + query exatamente como chamados (a assinatura cobre a URL inteira). */
    requestUrl: string;
    query: Record<string, string>;
    params: Record<string, string>;
    signature: string | undefined;
  }): Promise<void> {
    const provider = await this.verifyTwilio(input);
    const status = TWILIO_STATUS[input.params.MessageStatus ?? ''];
    if (status === undefined) return;
    const error = input.params.ErrorCode
      ? `Twilio ${input.params.ErrorCode}${input.params.ErrorMessage ? `: ${input.params.ErrorMessage}` : ''}`
      : null;
    this.tenant.enter(provider.tenantId);
    await this.jobs.add(ProviderEventsJob, {
      events: [{ messageId: input.query.m ?? null, status, error }],
    });
  }

  /** SMS recebido no número (para o "SAIR"). */
  async twilioInbound(input: {
    providerId: string;
    requestUrl: string;
    params: Record<string, string>;
    signature: string | undefined;
  }): Promise<void> {
    const provider = await this.verifyTwilio(input);
    const from = input.params.From;
    const body = input.params.Body;
    if (!from || body === undefined) return;
    this.tenant.enter(provider.tenantId);
    await this.jobs.add(InboundSmsJob, { from, body });
  }

  /** Eventos do SendGrid (lote), com a assinatura ECDSA sobre o corpo cru. */
  async sendgridEvents(input: {
    providerId: string;
    rawBody: Buffer | undefined;
    timestamp: string | undefined;
    signature: string | undefined;
  }): Promise<number> {
    const provider = await this.providers.findByIdAsSystem(input.providerId);
    if (provider?.settings.provider !== 'sendgrid' || !input.rawBody) throw new WebhookRejected();
    const publicKey = provider.settings.eventWebhookKey;
    // Sem a chave de verificação, não dá para saber se veio do SendGrid: recusa.
    if (
      !publicKey ||
      !this.verifier.sendgrid({
        publicKey,
        timestamp: input.timestamp,
        signature: input.signature,
        rawBody: input.rawBody,
      })
    ) {
      throw new WebhookRejected();
    }
    const events = parseSendGridEvents(input.rawBody);
    if (events.length === 0) return 0;
    this.tenant.enter(provider.tenantId);
    await this.jobs.add(ProviderEventsJob, { events });
    return events.length;
  }

  private async verifyTwilio(input: {
    providerId: string;
    requestUrl: string;
    params: Record<string, string>;
    signature: string | undefined;
  }): Promise<MessagingProvider> {
    const provider = await this.providers.findByIdAsSystem(input.providerId);
    if (provider?.settings.provider !== 'twilio') throw new WebhookRejected();
    const ok = this.verifier.twilio({
      url: `${this.urls.publicApiUrl}${input.requestUrl}`,
      params: input.params,
      signature: input.signature,
      authToken: this.cipher.open(provider.secret.sealed),
    });
    if (!ok) throw new WebhookRejected();
    return provider;
  }
}

/** Status da Twilio → o nosso (os intermediários não mudam nada). */
const TWILIO_STATUS: Record<string, ProviderEvent['status']> = {
  sent: 'sent',
  delivered: 'delivered',
  undelivered: 'failed',
  failed: 'failed',
};

/** Eventos do SendGrid → os nossos. Ignora o que não reconhece. */
export function parseSendGridEvents(raw: Buffer): ProviderEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item: Record<string, unknown>): ProviderEvent[] => {
    const messageId = typeof item.omni_message_id === 'string' ? item.omni_message_id : null;
    const email = typeof item.email === 'string' ? normalizeEmail(item.email) : null;
    const reason = typeof item.reason === 'string' ? item.reason : null;
    switch (item.event) {
      case 'processed':
        return [{ messageId, status: 'sent' }];
      case 'delivered':
        return [{ messageId, status: 'delivered' }];
      case 'bounce':
        return [
          {
            messageId,
            status: 'bounced',
            error: reason ?? 'Devolvido pelo servidor do destinatário',
          },
        ];
      case 'dropped':
        return [{ messageId, status: 'failed', error: reason ?? 'Descartado pelo SendGrid' }];
      case 'unsubscribe':
      case 'group_unsubscribe':
      case 'spamreport':
        return email
          ? [{ messageId, status: null, optOut: { channel: 'email', address: email } }]
          : [];
      default:
        return [];
    }
  });
}

/** Aplica os avisos dos provedores (worker, no tenant do provedor). Idempotente. */
@Injectable()
export class ApplyProviderEventsUseCase {
  constructor(
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(events: ProviderEvent[]): Promise<void> {
    for (const event of events) {
      if (event.optOut) {
        await this.optOuts.add({
          tenantId: this.tenant.tenantId,
          ...event.optOut,
          source: 'provider',
          createdAt: new Date(),
        });
      }
      if (!event.messageId || !event.status) continue;
      const message = await this.messages.findById(event.messageId);
      if (message?.applyProviderStatus(event.status, event.error)) {
        await this.messages.save(message);
      }
    }
  }
}

/** SMS recebido: "SAIR" (e variações) descadastra o número. */
@Injectable()
export class RecordInboundSmsUseCase {
  private readonly logger = new Logger(RecordInboundSmsUseCase.name);

  constructor(
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(input: { from: string; body: string }): Promise<void> {
    if (!isSmsOptOutReply(input.body)) return;
    const address = normalizePhoneNumber(input.from);
    if (!address) return;
    await this.optOuts.add({
      tenantId: this.tenant.tenantId,
      channel: 'sms',
      address,
      source: 'sms_reply',
      createdAt: new Date(),
    });
    this.logger.log(`Descadastro por SMS: ${address.slice(0, -4)}****`);
  }
}
