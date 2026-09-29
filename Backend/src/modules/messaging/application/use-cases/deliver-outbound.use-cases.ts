import { Inject, Injectable } from '@nestjs/common';
import { SECRET_CIPHER, type SecretCipher } from '../../../../shared/application/secret-cipher';
import { ProviderRejectedError } from '../../domain/errors/provider-rejected.error';
import { ProviderUnavailableError } from '../../domain/errors/provider-unavailable.error';
import type { MessagingProvider } from '../../domain/messaging-provider.entity';
import type { OutboundMessage } from '../../domain/outbound-message.entity';
import { composeEmail } from '../email-composer';
import {
  MESSAGING_PROVIDER_REPOSITORY,
  type MessagingProviderRepository,
} from '../ports/messaging-provider.repository';
import { MESSAGING_URLS, webhookPaths, type MessagingUrls } from '../ports/messaging-urls';
import { OPT_OUT_REPOSITORY, type OptOutRepository } from '../ports/opt-out.repository';
import {
  OUTBOUND_MESSAGE_REPOSITORY,
  type OutboundMessageRepository,
} from '../ports/outbound-message.repository';
import {
  PROVIDER_CLIENTS,
  type ProviderClients,
  type ProviderReceipt,
} from '../ports/provider-clients';
import { UNSUBSCRIBE_TOKENS, type UnsubscribeTokens } from '../ports/unsubscribe-tokens';

/**
 * Entrega uma mensagem da fila ao provedor (worker). Recusa do provedor é
 * final (a mensagem vira "falhou" com o motivo dele); provedor fora do ar
 * lança de novo para a fila repetir — o motivo fica na mensagem enquanto isso.
 * Só mensagens "na fila" são entregues: job repetido não reenvia.
 */
@Injectable()
export class DeliverOutboundMessageUseCase {
  constructor(
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
    @Inject(PROVIDER_CLIENTS) private readonly clients: ProviderClients,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(UNSUBSCRIBE_TOKENS) private readonly tokens: UnsubscribeTokens,
    @Inject(MESSAGING_URLS) private readonly urls: MessagingUrls,
  ) {}

  async execute(messageId: string): Promise<void> {
    const message = await this.messages.findById(messageId);
    if (!message || message.status !== 'queued') return;

    const provider = await this.providers.findByChannel(message.channel);
    if (!provider) return this.fail(message, 'MESSAGING_NOT_CONFIGURED');
    // O descadastro pode ter chegado depois de a mensagem entrar na fila.
    if (await this.optOuts.isOptedOut(message.channel, message.to)) {
      return this.fail(message, 'MESSAGING_OPTED_OUT');
    }

    let receipt: ProviderReceipt;
    try {
      receipt = await this.send(message, provider);
    } catch (error) {
      if (error instanceof ProviderRejectedError) return this.fail(message, error.reason);
      if (error instanceof ProviderUnavailableError) {
        message.noteRetry(error.reason);
        await this.messages.save(message);
      }
      throw error;
    }
    message.markSent(receipt.providerMessageId);
    await this.messages.save(message);
  }

  private send(message: OutboundMessage, provider: MessagingProvider): Promise<ProviderReceipt> {
    const secret = this.cipher.open(provider.secret.sealed);
    const { settings } = provider;
    if (settings.provider === 'sendgrid') {
      const token = this.tokens.create({
        tenantId: message.tenantId,
        channel: 'email',
        address: message.to,
      });
      return this.clients.email(settings.provider).send(
        settings,
        secret,
        composeEmail({
          to: message.to,
          subject: message.subject ?? '',
          body: message.body,
          senderName: settings.fromName,
          unsubscribeUrl: this.urls.publicApiUrl + webhookPaths.unsubscribe(token),
          messageId: message.id,
        }),
      );
    }
    return this.clients.sms(settings.provider).send(settings, secret, {
      to: message.to,
      body: message.body,
      // O nosso id vai na URL (a assinatura da Twilio cobre a URL inteira).
      statusCallbackUrl: this.urls.webhooksReachable
        ? `${this.urls.publicApiUrl}${webhookPaths.twilioStatus(provider.id)}?m=${message.id}`
        : undefined,
    });
  }

  private async fail(message: OutboundMessage, reason: string): Promise<void> {
    message.markFailed(reason);
    await this.messages.save(message);
  }
}

/** A fila desistiu (provedor fora do ar em todas as tentativas): marca como falha. */
@Injectable()
export class GiveUpOutboundMessageUseCase {
  constructor(
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
  ) {}

  async execute(messageId: string): Promise<void> {
    const message = await this.messages.findById(messageId);
    if (!message || message.status !== 'queued') return;
    message.markFailed(
      `Não entregue após várias tentativas: ${message.error ?? 'provedor indisponível'}`,
    );
    await this.messages.save(message);
  }
}
