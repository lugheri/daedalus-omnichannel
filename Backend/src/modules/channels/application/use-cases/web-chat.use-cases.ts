import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { Channel, type WebChatSettings } from '../../domain/channel.entity';
import { ChannelNotFoundError } from '../../domain/errors/channel-not-found.error';
import { ChannelMessageReceivedEvent } from '../../domain/events/channel-events';
import { CHANNEL_REPOSITORY, type ChannelRepository } from '../ports/channel.repository';
import { PUBLIC_KEY_GENERATOR, type PublicKeyGenerator } from '../ports/public-key-generator';

/** Maior mensagem que o visitante manda pelo widget. */
export const MAX_WEB_CHAT_TEXT = 2_000;

async function loadWebChat(channels: ChannelRepository, id: string): Promise<Channel> {
  const channel = await channels.findById(id);
  if (!channel) throw new ChannelNotFoundError();
  channel.assertWebChat();
  return channel;
}

/** Chat do site novo: já ligado, com a chave do widget e as configurações padrão. */
@Injectable()
export class CreateWebChatChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(PUBLIC_KEY_GENERATOR) private readonly keys: PublicKeyGenerator,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { name: string }): Promise<Channel> {
    const channel = Channel.createWebChat(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      name: input.name,
      publicKey: this.keys.generate(),
    });
    await this.channels.save(channel);
    return channel;
  }
}

/**
 * Título, saudação e cor do widget; `rotateKey` gera chave nova (o código
 * colado com a antiga para de funcionar; o site do módulo de sites pega a
 * nova ao publicar de novo).
 */
@Injectable()
export class UpdateWebChatChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(PUBLIC_KEY_GENERATOR) private readonly keys: PublicKeyGenerator,
  ) {}

  async execute(
    channelId: string,
    changes: Partial<WebChatSettings> & { rotateKey?: boolean },
  ): Promise<Channel> {
    const channel = await loadWebChat(this.channels, channelId);
    const { rotateKey, ...settings } = changes;
    channel.updateWebChatSettings(settings);
    if (rotateKey) channel.rotatePublicKey(this.keys.generate());
    await this.channels.save(channel);
    return channel;
  }
}

/**
 * Mensagem do visitante (rota pública do widget, no tenant do canal): vira o
 * mesmo evento das mensagens do WhatsApp, com o contato já identificado.
 * Conversations grava pela fila — idempotente pelo `externalId` que o widget
 * gera (reenviar a mesma mensagem não duplica).
 */
@Injectable()
export class ReceiveWebChatMessageUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: {
    channelId: string;
    contactId: string;
    contactName: string | null;
    externalId: string;
    text: string;
  }): Promise<void> {
    const channel = await loadWebChat(this.channels, input.channelId);
    channel.assertCanSend(); // desligado: o widget não recebe mais mensagens
    await this.unitOfWork.run(() =>
      this.events.publish([
        new ChannelMessageReceivedEvent(channel.id, channel.tenantId, {
          externalId: input.externalId,
          contactPhone: null,
          contactHandle: input.contactId,
          contactId: input.contactId,
          contactName: input.contactName,
          fromMe: false,
          kind: 'text',
          text: input.text.slice(0, MAX_WEB_CHAT_TEXT),
          sentAt: new Date().toISOString(),
          media: null,
        }),
      ]),
    );
  }
}
