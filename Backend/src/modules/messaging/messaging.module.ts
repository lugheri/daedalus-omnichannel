import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AccountsModule } from '../accounts';
import { MESSAGING_PROVIDER_REPOSITORY } from './application/ports/messaging-provider.repository';
import { PROVIDER_CLIENTS } from './application/ports/provider-clients';
import {
  ListMessagingProvidersUseCase,
  RemoveMessagingProviderUseCase,
  SaveMessagingProviderUseCase,
  SendTestMessageUseCase,
} from './application/use-cases/messaging-settings.use-cases';
import { MessagingSettingsController } from './http/messaging-settings.controller';
import { PrismaMessagingProviderRepository } from './infra/prisma-messaging-provider.repository';
import { ProviderClientsRegistry } from './infra/provider-clients.registry';
import { SendGridClient } from './infra/sendgrid.client';
import { PROVIDER_ENDPOINTS, type ProviderEndpoints } from './infra/provider-endpoints';
import { TwilioSmsClient } from './infra/twilio-sms.client';

/**
 * Envio de e-mail e SMS pelas contas dos próprios clientes (SendGrid e
 * Twilio). Nesta etapa: configuração dos provedores e envio de teste.
 */
@Module({
  imports: [AccountsModule],
  controllers: [MessagingSettingsController],
  providers: [
    ListMessagingProvidersUseCase,
    SaveMessagingProviderUseCase,
    RemoveMessagingProviderUseCase,
    SendTestMessageUseCase,
    {
      provide: PROVIDER_ENDPOINTS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): ProviderEndpoints => ({
        sendgridApiUrl: config.sendgridApiUrl,
        twilioApiUrl: config.twilioApiUrl,
      }),
    },
    SendGridClient,
    TwilioSmsClient,
    { provide: PROVIDER_CLIENTS, useClass: ProviderClientsRegistry },
    { provide: MESSAGING_PROVIDER_REPOSITORY, useClass: PrismaMessagingProviderRepository },
  ],
})
export class MessagingModule {}
