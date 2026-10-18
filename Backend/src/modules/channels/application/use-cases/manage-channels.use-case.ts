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
import { ChannelTeamNotFoundError } from '../../domain/errors/channel-team-not-found.error';
import { ChannelSender } from '../channel-sender';
import { TEAM_GATEWAY, type TeamGateway } from '../ports/team-gateway';
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
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(TEAM_GATEWAY) private readonly teams: TeamGateway,
  ) {}

  /** Canais com o nome da equipe (quem configura canais nem sempre gerencia equipes). */
  async execute(): Promise<{ channel: Channel; teamName: string | null }[]> {
    const channels = await this.channels.list();
    const teamIds = channels.flatMap((c) => (c.teamId ? [c.teamId] : []));
    const teams = new Map((await this.teams.findByIds(teamIds)).map((t) => [t.id, t.name]));
    return channels.map((channel) => ({
      channel,
      teamName: channel.teamId ? (teams.get(channel.teamId) ?? null) : null,
    }));
  }
}

/** Equipe que recebe as conversas NOVAS do canal (as existentes ficam onde estão). */
@Injectable()
export class SetChannelTeamUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(TEAM_GATEWAY) private readonly teams: TeamGateway,
  ) {}

  async execute(input: { channelId: string; teamId: string | null }): Promise<void> {
    const channel = await load(this.channels, input.channelId);
    if (input.teamId && !(await this.teams.exists(input.teamId)))
      throw new ChannelTeamNotFoundError();
    channel.setTeam(input.teamId);
    await this.channels.save(channel);
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

/**
 * (Re)conectar. WhatsApp: depois de desconectado, ou se ficou pendente (o
 * conector gera o QR code). Chat do site: liga o widget, na hora.
 */
@Injectable()
export class ConnectChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(channelId: string): Promise<void> {
    const channel = await load(this.channels, channelId);
    if (channel.isWebChat)
      return toggleWebChat(
        { channels: this.channels, events: this.events, unitOfWork: this.unitOfWork },
        channel,
        true,
      );
    await this.jobs.add(StartWhatsAppSession, { channelId, tenantId: channel.tenantId });
  }
}

/**
 * WhatsApp: desconectar e desfazer o pareamento (reconectar exigirá novo QR
 * code). Chat do site: desliga o widget (some do site).
 */
@Injectable()
export class DisconnectChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(channelId: string): Promise<void> {
    const channel = await load(this.channels, channelId);
    if (channel.isWebChat)
      return toggleWebChat(
        { channels: this.channels, events: this.events, unitOfWork: this.unitOfWork },
        channel,
        false,
      );
    await this.jobs.add(StopWhatsAppSession, { channelId, logout: true });
  }
}

/** Liga/desliga o chat do site, com o evento de status (como os relatos do conector). */
async function toggleWebChat(
  deps: { channels: ChannelRepository; events: EventBus; unitOfWork: UnitOfWork },
  channel: Channel,
  enabled: boolean,
): Promise<void> {
  channel.setWebChatEnabled(enabled, new Date());
  await deps.unitOfWork.run(async () => {
    await deps.channels.save(channel);
    await deps.events.publish(channel.pullEvents());
  });
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
    private readonly sender: ChannelSender,
  ) {}

  async execute(input: { channelId: string; to: string; text: string }): Promise<string> {
    const channel = await load(this.channels, input.channelId);
    channel.assertWhatsApp();
    const messageId = this.ids.generate();
    await this.sender.send(channel, { messageId, to: input.to, text: input.text });
    return messageId;
  }
}
