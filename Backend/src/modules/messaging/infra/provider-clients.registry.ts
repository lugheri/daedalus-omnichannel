import { Injectable } from '@nestjs/common';
import type {
  EmailProviderClient,
  ProviderClients,
  SmsProviderClient,
} from '../application/ports/provider-clients';
import type { EmailSettings, SmsSettings } from '../domain/messaging-provider.entity';
import { SendGridClient } from './sendgrid.client';
import { TwilioSmsClient } from './twilio-sms.client';

/**
 * Qual cliente atende cada provedor. Provedor de SMS novo: um cliente que
 * implementa SmsProviderClient, uma entrada aqui e o tipo em SmsSettings.
 */
@Injectable()
export class ProviderClientsRegistry implements ProviderClients {
  constructor(
    private readonly sendgrid: SendGridClient,
    private readonly twilio: TwilioSmsClient,
  ) {}

  email(provider: EmailSettings['provider']): EmailProviderClient {
    switch (provider) {
      case 'sendgrid':
        return this.sendgrid;
    }
  }

  sms(provider: SmsSettings['provider']): SmsProviderClient {
    switch (provider) {
      case 'twilio':
        return this.twilio;
    }
  }
}
