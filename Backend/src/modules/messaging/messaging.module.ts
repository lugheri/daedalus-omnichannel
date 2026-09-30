import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AccountsModule } from '../accounts';
import { ContactsModule } from '../contacts';
import { MESSAGING_QUEUE } from './application/messaging-jobs';
import { CONTACT_DIRECTORY } from './application/ports/contact-directory';
import { MESSAGING_PROVIDER_REPOSITORY } from './application/ports/messaging-provider.repository';
import { MESSAGING_URLS, type MessagingUrls } from './application/ports/messaging-urls';
import { OPT_OUT_REPOSITORY } from './application/ports/opt-out.repository';
import { OUTBOUND_MESSAGE_REPOSITORY } from './application/ports/outbound-message.repository';
import { PROVIDER_CLIENTS } from './application/ports/provider-clients';
import { UNSUBSCRIBE_TOKENS } from './application/ports/unsubscribe-tokens';
import { WEBHOOK_VERIFIER } from './application/ports/webhook-verifier';
import {
  GetAvailableChannelsUseCase,
  ListContactMessagesUseCase,
  ListContactOptOutsUseCase,
  RemoveContactOptOutUseCase,
  SendToContactUseCase,
} from './application/use-cases/contact-messages.use-cases';
import {
  DeliverOutboundMessageUseCase,
  GiveUpOutboundMessageUseCase,
} from './application/use-cases/deliver-outbound.use-cases';
import {
  ListMessagingProvidersUseCase,
  RemoveMessagingProviderUseCase,
  SaveMessagingProviderUseCase,
  SendTestMessageUseCase,
} from './application/use-cases/messaging-settings.use-cases';
import {
  AcceptProviderWebhookUseCase,
  ApplyProviderEventsUseCase,
  RecordInboundSmsUseCase,
} from './application/use-cases/provider-webhooks.use-cases';
import { UnsubscribeUseCase } from './application/use-cases/unsubscribe.use-cases';
import { CAMPAIGN_REPOSITORY } from './application/ports/campaign.repository';
import {
  MaterializeCampaignUseCase,
  StartDueCampaignsUseCase,
} from './application/use-cases/campaign-sending.use-cases';
import {
  CancelCampaignUseCase,
  CreateCampaignUseCase,
  DeleteCampaignUseCase,
  GetCampaignUseCase,
  ListCampaignRecipientsUseCase,
  ListCampaignsUseCase,
  PreviewAudienceUseCase,
  ScheduleCampaignUseCase,
  UnscheduleCampaignUseCase,
  UpdateCampaignUseCase,
} from './application/use-cases/campaigns.use-cases';
import { CampaignsController } from './http/campaigns.controller';
import { PrismaCampaignRepository } from './infra/prisma-campaign.repository';
import { ContactMessagesController } from './http/contact-messages.controller';
import { MessagingSettingsController } from './http/messaging-settings.controller';
import { PublicMessagingController } from './http/public-messaging.controller';
import { CryptoWebhookVerifier } from './infra/crypto-webhook-verifier';
import { ContactsFacadeDirectory } from './infra/facade-gateways';
import { HmacUnsubscribeTokens } from './infra/hmac-unsubscribe-tokens';
import { PrismaMessagingProviderRepository } from './infra/prisma-messaging-provider.repository';
import {
  PrismaOptOutRepository,
  PrismaOutboundMessageRepository,
} from './infra/prisma-outbound.repositories';
import { ProviderClientsRegistry } from './infra/provider-clients.registry';
import { PROVIDER_ENDPOINTS, type ProviderEndpoints } from './infra/provider-endpoints';
import { SendGridClient } from './infra/sendgrid.client';
import { TwilioSmsClient } from './infra/twilio-sms.client';

/** Provedores só alcançam endereços públicos: https e fora de localhost. */
function webhooksReachable(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

/**
 * Envio de e-mail e SMS pelas contas dos próprios clientes (SendGrid e
 * Twilio): configuração, envio individual pela ficha do contato (fila),
 * avisos de entrega (webhooks) e descadastro.
 */
@Module({
  imports: [AccountsModule, ContactsModule, BullModule.registerQueue({ name: MESSAGING_QUEUE })],
  controllers: [
    MessagingSettingsController,
    ContactMessagesController,
    PublicMessagingController,
    CampaignsController,
  ],
  providers: [
    // Configuração
    ListMessagingProvidersUseCase,
    SaveMessagingProviderUseCase,
    RemoveMessagingProviderUseCase,
    SendTestMessageUseCase,
    // Envio e histórico
    GetAvailableChannelsUseCase,
    SendToContactUseCase,
    ListContactMessagesUseCase,
    ListContactOptOutsUseCase,
    RemoveContactOptOutUseCase,
    DeliverOutboundMessageUseCase,
    GiveUpOutboundMessageUseCase,
    // Webhooks e descadastro
    AcceptProviderWebhookUseCase,
    ApplyProviderEventsUseCase,
    RecordInboundSmsUseCase,
    UnsubscribeUseCase,
    // Campanhas
    ListCampaignsUseCase,
    GetCampaignUseCase,
    CreateCampaignUseCase,
    UpdateCampaignUseCase,
    ScheduleCampaignUseCase,
    UnscheduleCampaignUseCase,
    CancelCampaignUseCase,
    DeleteCampaignUseCase,
    PreviewAudienceUseCase,
    ListCampaignRecipientsUseCase,
    MaterializeCampaignUseCase,
    StartDueCampaignsUseCase,
    // Adapters
    {
      provide: PROVIDER_ENDPOINTS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): ProviderEndpoints => ({
        sendgridApiUrl: config.sendgridApiUrl,
        twilioApiUrl: config.twilioApiUrl,
      }),
    },
    {
      provide: MESSAGING_URLS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): MessagingUrls => ({
        publicApiUrl: config.publicApiUrl,
        webhooksReachable: webhooksReachable(config.publicApiUrl),
      }),
    },
    {
      provide: UNSUBSCRIBE_TOKENS,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => new HmacUnsubscribeTokens(config.encryptionKey),
    },
    SendGridClient,
    TwilioSmsClient,
    { provide: PROVIDER_CLIENTS, useClass: ProviderClientsRegistry },
    { provide: WEBHOOK_VERIFIER, useClass: CryptoWebhookVerifier },
    { provide: CONTACT_DIRECTORY, useClass: ContactsFacadeDirectory },
    { provide: MESSAGING_PROVIDER_REPOSITORY, useClass: PrismaMessagingProviderRepository },
    { provide: OUTBOUND_MESSAGE_REPOSITORY, useClass: PrismaOutboundMessageRepository },
    { provide: OPT_OUT_REPOSITORY, useClass: PrismaOptOutRepository },
    { provide: CAMPAIGN_REPOSITORY, useClass: PrismaCampaignRepository },
  ],
  exports: [
    DeliverOutboundMessageUseCase,
    GiveUpOutboundMessageUseCase,
    ApplyProviderEventsUseCase,
    RecordInboundSmsUseCase,
    MaterializeCampaignUseCase,
    StartDueCampaignsUseCase,
  ],
})
export class MessagingModule {}
