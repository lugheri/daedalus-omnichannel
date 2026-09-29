import { Inject, Injectable } from '@nestjs/common';
import type {
  EmailMessage,
  EmailProviderClient,
  ProviderReceipt,
} from '../application/ports/provider-clients';
import type { EmailSettings } from '../domain/messaging-provider.entity';
import { PROVIDER_ENDPOINTS, type ProviderEndpoints } from './provider-endpoints';
import { callProvider } from './provider-http';

/** SendGrid v3 Mail Send (https://www.twilio.com/docs/sendgrid/api-reference/mail-send). */
@Injectable()
export class SendGridClient implements EmailProviderClient {
  constructor(@Inject(PROVIDER_ENDPOINTS) private readonly endpoints: ProviderEndpoints) {}

  async send(
    settings: EmailSettings,
    apiKey: string,
    message: EmailMessage,
  ): Promise<ProviderReceipt> {
    const response = await callProvider(
      `${this.endpoints.sendgridApiUrl}/v3/mail/send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: settings.fromEmail, name: settings.fromName },
          ...(settings.replyTo && { reply_to: { email: settings.replyTo } }),
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text },
            ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
          ],
          ...(message.headers && { headers: message.headers }),
          // Voltam em cada evento do Event Webhook: é assim que achamos a mensagem.
          ...(message.customArgs && { custom_args: message.customArgs }),
        }),
      },
      describeSendGridError,
    );
    // 202 Accepted: o id vem no cabeçalho (os avisos de entrega trazem o mesmo).
    return { providerMessageId: response.headers.get('x-message-id') };
  }
}

/** { errors: [{ message, field }] } → "mensagem (campo); ..." */
function describeSendGridError(status: number, body: unknown): string {
  const errors = (body as { errors?: { message?: string; field?: string | null }[] } | null)
    ?.errors;
  if (errors?.length) {
    return errors
      .map((e) => (e.field ? `${e.message ?? 'erro'} (${e.field})` : (e.message ?? 'erro')))
      .join('; ');
  }
  return status === 401 || status === 403 ? 'chave de API recusada' : 'erro do SendGrid';
}
