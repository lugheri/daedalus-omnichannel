import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  ConnectChannelUseCase,
  CreateWhatsAppChannelUseCase,
  DisconnectChannelUseCase,
  GetChannelQrCodeUseCase,
  ListChannelsUseCase,
  RemoveChannelUseCase,
  SendTestMessageUseCase,
  SetChannelTeamUseCase,
} from '../application/use-cases/manage-channels.use-case';
import type { Channel } from '../domain/channel.entity';
import {
  channelTeamSchema,
  createChannelSchema,
  testMessageSchema,
  type ChannelTeamDto,
  type CreateChannelDto,
  type TestMessageDto,
} from './dto/channel.dto';

const idParam = z.uuid();

const present = (channel: Channel, teamName: string | null = null) => ({
  id: channel.id,
  teamId: channel.teamId,
  teamName,
  name: channel.name,
  provider: channel.provider,
  status: channel.status,
  phoneNumber: channel.phoneNumber,
  statusReason: channel.statusReason,
  statusAt: channel.statusAt.toISOString(),
  createdAt: channel.createdAt.toISOString(),
});

@RequirePermissions('channels:manage')
@Controller('v1/channels')
export class ChannelsController {
  constructor(
    private readonly listChannels: ListChannelsUseCase,
    private readonly createChannel: CreateWhatsAppChannelUseCase,
    private readonly connectChannel: ConnectChannelUseCase,
    private readonly disconnectChannel: DisconnectChannelUseCase,
    private readonly getQrCode: GetChannelQrCodeUseCase,
    private readonly sendTestMessage: SendTestMessageUseCase,
    private readonly removeChannel: RemoveChannelUseCase,
    private readonly setChannelTeam: SetChannelTeamUseCase,
  ) {}

  @Get()
  async list() {
    return (await this.listChannels.execute()).map(({ channel, teamName }) =>
      present(channel, teamName),
    );
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createChannelSchema)) body: CreateChannelDto) {
    return present(await this.createChannel.execute(body));
  }

  /** Status + QR code atual. O front consulta a cada poucos segundos durante o pareamento. */
  @Get(':id/connection')
  async connection(@Param('id', new ZodValidationPipe(idParam)) id: string) {
    const { channel, qrCode } = await this.getQrCode.execute(id);
    return { ...present(channel), qrCode };
  }

  @Post(':id/connect')
  @HttpCode(HttpStatus.ACCEPTED)
  async connect(@Param('id', new ZodValidationPipe(idParam)) id: string) {
    await this.connectChannel.execute(id);
  }

  @Post(':id/disconnect')
  @HttpCode(HttpStatus.ACCEPTED)
  async disconnect(@Param('id', new ZodValidationPipe(idParam)) id: string) {
    await this.disconnectChannel.execute(id);
  }

  /** Equipe que recebe as conversas novas do canal (`null` = fila geral). */
  @Patch(':id/team')
  @HttpCode(HttpStatus.NO_CONTENT)
  async team(
    @Param('id', new ZodValidationPipe(idParam)) channelId: string,
    @Body(new ZodValidationPipe(channelTeamSchema)) body: ChannelTeamDto,
  ) {
    await this.setChannelTeam.execute({ channelId, teamId: body.teamId });
  }

  /** Só canais desconectados ou não pareados (senão 409 CHANNEL_STILL_ACTIVE). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParam)) id: string) {
    await this.removeChannel.execute(id);
  }

  /** Envio avulso para testar o canal (202: vai para a fila do conector). */
  @Post(':id/test-message')
  @HttpCode(HttpStatus.ACCEPTED)
  async testMessage(
    @Param('id', new ZodValidationPipe(idParam)) channelId: string,
    @Body(new ZodValidationPipe(testMessageSchema)) body: TestMessageDto,
  ) {
    return { messageId: await this.sendTestMessage.execute({ channelId, ...body }) };
  }
}
