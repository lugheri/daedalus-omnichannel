import { Inject, Injectable } from '@nestjs/common';
import type { ProviderReceipt, SmsProviderClient } from '../application/ports/provider-clients';
import type { SmsSettings } from '../domain/messaging-provider.entity';
import { PROVIDER_ENDPOINTS, type ProviderEndpoints } from './provider-endpoints';
import { callProvider } from './provider-http';

/** Twilio Programmable Messaging (https://www.twilio.com/docs/messaging/api/message-resource). */
@Injectable()
export class TwilioSmsClient implements SmsProviderClient {
  constructor(@Inject(PROVIDER_ENDPOINTS) private readonly endpoints: ProviderEndpoints) {}

  async send(
    settings: SmsSettings,
    authToken: string,
    message: { to: string; body: string },
  ): Promise<ProviderReceipt> {
    const form = new URLSearchParams({ To: message.to, Body: message.body });
    if (settings.messagingServiceSid) form.set('MessagingServiceSid', settings.messagingServiceSid);
    else if (settings.from) form.set('From', settings.from);

    const credentials = Buffer.from(`${settings.accountSid}:${authToken}`).toString('base64');
    const response = await callProvider(
      `${this.endpoints.twilioApiUrl}/2010-04-01/Accounts/${encodeURIComponent(settings.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
      describeTwilioError,
    );
    const body = (await response.json().catch(() => null)) as { sid?: string } | null;
    return { providerMessageId: body?.sid ?? null };
  }
}

/** { code, message } → "mensagem [código]" */
function describeTwilioError(status: number, body: unknown): string {
  const error = body as { code?: number; message?: string } | null;
  if (error?.message) return error.code ? `${error.message} [${error.code}]` : error.message;
  return status === 401 ? 'Account SID ou Auth Token recusados' : 'erro da Twilio';
}
