import { Inject, Injectable } from '@nestjs/common';
import {
  StartWhatsAppSession,
  StopWhatsAppSession,
} from '../../../../contracts/whatsapp-connector.contract';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { Channel } from '../../domain/channel.entity';
import { ChannelNotFoundError } from '../../domain/errors/channel-not-found.error';
import { ChannelTextSender } from '../channel-text-sender';
import { CHANNEL_REPOSITORY, type ChannelRepository } from '../ports/channel.repository';
import { QR_CODE_READER, type QrCodeReader } from '../ports/qr-code-reader';

/** Carrega um canal do tenant atual (senão 404). */
async function load(channels: ChannelRepository, id: string): Promise<Channel> {
  const channel = await channels.findById(id);
  if (!channel) throw new ChannelNotFoundError();
  return channel;
}

@Injectable()
export class ListChannelsUseCase {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository) {}

  execute(): Promise<Channel[]> {
    return this.channels.list();
  }
}

/**
 * Cria um canal de WhatsApp e pede ao conector que inicie a sessão — que vai
 * gerar o QR code para pareamento.
 */
@Injectable()
export class CreateWhatsAppChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(input: { name: string }): Promise<Channel> {
    const channel = Channel.createWhatsApp(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      name: input.name,
    });
    await this.channels.save(channel);
    await this.jobs.add(StartWhatsAppSession, {
      channelId: channel.id,
      tenantId: channel.tenantId,
    });
    return channel;
  }
}

/** (Re)conectar: depois de desconectado, ou se o canal ficou pendente. */
@Injectable()
export class ConnectChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(channelId: string): Promise<void> {
    const channel = await load(this.channels, channelId);
    await this.jobs.add(StartWhatsAppSession, { channelId, tenantId: channel.tenantId });
  }
}

/** Desconectar e desfazer o pareamento (reconectar exigirá novo QR code). */
@Injectable()
export class DisconnectChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(channelId: string): Promise<void> {
    await load(this.channels, channelId);
    await this.jobs.add(StopWhatsAppSession, { channelId, logout: true });
  }
}

/**
 * Remove um canal parado (desconectado ou não pareado). A limpeza da sessão
 * no conector acontece pelo evento `channel.removed.v1` (outbox): gravado na
 * mesma transação da remoção, não se perde se a fila estiver fora.
 */
@Injectable()
export class RemoveChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(channelId: string): Promise<void> {
    await this.unitOfWork.run(async () => {
      const channel = await load(this.channels, channelId);
      channel.remove();
      await this.channels.delete(channel);
      await this.events.publish(channel.pullEvents());
    });
  }
}

/** QR code atual; `null` se o canal já está conectado ou o QR ainda não saiu. */
@Injectable()
export class GetChannelQrCodeUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(QR_CODE_READER) private readonly qrCodes: QrCodeReader,
  ) {}

  async execute(channelId: string): Promise<{ channel: Channel; qrCode: string | null }> {
    const channel = await load(this.channels, channelId);
    const qrCode = channel.status === 'connected' ? null : await this.qrCodes.read(channelId);
    return { channel, qrCode };
  }
}

/**
 * Envio de texto avulso pelo canal. Serve para testar a conexão agora; o
 * atendimento de verdade enviará pelas conversas (mesmo comando).
 */
@Injectable()
export class SendTestMessageUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly sender: ChannelTextSender,
  ) {}

  async execute(input: { channelId: string; to: string; text: string }): Promise<string> {
    const channel = await load(this.channels, input.channelId);
    const messageId = this.ids.generate();
    await this.sender.send(channel, { messageId, to: input.to, text: input.text });
    return messageId;
  }
}
