import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WHATSAPP_CONNECTOR_QUEUE } from '../../contracts/whatsapp-connector.contract';
import { AccountsModule } from '../accounts';
import { ChannelSender } from './application/channel-sender';
import { ChannelsFacade } from './application/channels.facade';
import { CHANNEL_REPOSITORY } from './application/ports/channel.repository';
import { ChannelsTeamCleanupHandler } from './application/event-handlers/channels-team-cleanup.handler';
import { PurgeConnectorSessionHandler } from './application/event-handlers/purge-connector-session.handler';
import { PUBLIC_KEY_GENERATOR } from './application/ports/public-key-generator';
import { QR_CODE_READER } from './application/ports/qr-code-reader';
import { TEAM_GATEWAY } from './application/ports/team-gateway';
import {
  ApplyConnectionReportUseCase,
  RecordInboundMessageUseCase,
  RecordSendResultUseCase,
} from './application/use-cases/connector-reports.use-case';
import {
  ConnectChannelUseCase,
  CreateWhatsAppChannelUseCase,
  DisconnectChannelUseCase,
  GetChannelQrCodeUseCase,
  ListChannelsUseCase,
  RemoveChannelUseCase,
  SendTestMessageUseCase,
  SetChannelTeamUseCase,
} from './application/use-cases/manage-channels.use-case';
import {
  CreateWebChatChannelUseCase,
  ReceiveWebChatMessageUseCase,
  UpdateWebChatChannelUseCase,
} from './application/use-cases/web-chat.use-cases';
import { ChannelsController } from './http/channels.controller';
import { PrismaChannelRepository } from './infra/prisma-channel.repository';
import { RandomPublicKeyGenerator } from './infra/random-public-key.generator';
import { RedisQrCodeReader } from './infra/redis-qr-code.reader';
import { TeamsFacadeGateway } from './infra/teams-facade.gateway';
import { TeamsModule } from '../teams';

/**
 * Canais de atendimento: WhatsApp e chat do site (ADR 0012). Comandos para o
 * conector do WhatsApp saem pela fila `whatsapp-connector` (contrato em
 * src/contracts); os relatos do conector são processados no worker
 * (channels.worker.module.ts). O lado público do chat do site (widget) é o
 * módulo webchat.
 */
@Module({
  // AccountsModule: os limites do plano (PLAN_ENTITLEMENTS, ADR 0015).
  imports: [
    AccountsModule,
    TeamsModule,
    BullModule.registerQueue({ name: WHATSAPP_CONNECTOR_QUEUE }),
  ],
  controllers: [ChannelsController],
  providers: [
    ListChannelsUseCase,
    CreateWhatsAppChannelUseCase,
    CreateWebChatChannelUseCase,
    UpdateWebChatChannelUseCase,
    ReceiveWebChatMessageUseCase,
    ConnectChannelUseCase,
    DisconnectChannelUseCase,
    GetChannelQrCodeUseCase,
    SendTestMessageUseCase,
    RemoveChannelUseCase,
    SetChannelTeamUseCase,
    ApplyConnectionReportUseCase,
    RecordInboundMessageUseCase,
    RecordSendResultUseCase,
    PurgeConnectorSessionHandler,
    ChannelsTeamCleanupHandler,
    ChannelSender,
    ChannelsFacade,
    { provide: CHANNEL_REPOSITORY, useClass: PrismaChannelRepository },
    { provide: QR_CODE_READER, useClass: RedisQrCodeReader },
    { provide: PUBLIC_KEY_GENERATOR, useClass: RandomPublicKeyGenerator },
    { provide: TEAM_GATEWAY, useClass: TeamsFacadeGateway },
  ],
  exports: [
    ChannelsFacade,
    ApplyConnectionReportUseCase,
    RecordInboundMessageUseCase,
    RecordSendResultUseCase,
  ],
})
export class ChannelsModule {}
