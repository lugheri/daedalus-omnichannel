import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WHATSAPP_CONNECTOR_QUEUE } from '../../contracts/whatsapp-connector.contract';
import { ChannelTextSender } from './application/channel-text-sender';
import { ChannelsFacade } from './application/channels.facade';
import { CHANNEL_REPOSITORY } from './application/ports/channel.repository';
import { ChannelsTeamCleanupHandler } from './application/event-handlers/channels-team-cleanup.handler';
import { PurgeConnectorSessionHandler } from './application/event-handlers/purge-connector-session.handler';
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
import { ChannelsController } from './http/channels.controller';
import { PrismaChannelRepository } from './infra/prisma-channel.repository';
import { RedisQrCodeReader } from './infra/redis-qr-code.reader';
import { TeamsFacadeGateway } from './infra/teams-facade.gateway';
import { TeamsModule } from '../teams';

/**
 * Canais de atendimento. Comandos para o conector do WhatsApp saem pela fila
 * `whatsapp-connector` (contrato em src/contracts); os relatos do conector
 * são processados no worker (channels.worker.module.ts).
 */
@Module({
  imports: [TeamsModule, BullModule.registerQueue({ name: WHATSAPP_CONNECTOR_QUEUE })],
  controllers: [ChannelsController],
  providers: [
    ListChannelsUseCase,
    CreateWhatsAppChannelUseCase,
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
    ChannelTextSender,
    ChannelsFacade,
    { provide: CHANNEL_REPOSITORY, useClass: PrismaChannelRepository },
    { provide: QR_CODE_READER, useClass: RedisQrCodeReader },
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
