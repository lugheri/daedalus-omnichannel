import { DomainEvent } from '../../../../shared/domain/domain-event';
import type { ChannelProvider, ChannelStatus } from '../channel.entity';

/**
 * Eventos públicos do módulo channels (exportados no index.ts). O módulo de
 * conversas consome as mensagens; outros podem reagir a mudanças de status.
 */

export type MessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'unsupported';

/** Arquivo anexo, já gravado no armazenamento (bucket privado): só a referência. */
export interface ChannelMedia {
  key: string;
  mimeType: string;
  size: number;
  fileName: string | null;
}

/** Mensagem de conversa 1:1 que passou pelo canal (recebida ou enviada pelo celular). */
export class ChannelMessageReceivedEvent extends DomainEvent {
  static readonly eventName = 'channel.message.received.v1';
  readonly eventName = ChannelMessageReceivedEvent.eventName;

  constructor(
    channelId: string,
    readonly tenantId: string,
    readonly message: {
      /** Id no provedor — use para idempotência. */
      externalId: string;
      contactPhone: string | null;
      contactHandle: string;
      contactName: string | null;
      /** true = enviada pelo próprio número (ex.: respondida no celular). */
      fromMe: boolean;
      kind: MessageKind;
      text: string | null;
      sentAt: string;
      /** null: sem anexo, grande demais ou falha no download. */
      media: ChannelMedia | null;
    },
  ) {
    super(channelId);
  }
}

/** Resultado de um envio feito pelo sistema. */
export class ChannelMessageSendResultEvent extends DomainEvent {
  static readonly eventName = 'channel.message.send-result.v1';
  readonly eventName = ChannelMessageSendResultEvent.eventName;

  constructor(
    channelId: string,
    readonly tenantId: string,
    readonly result: {
      messageId: string;
      status: 'sent' | 'failed';
      externalId: string | null;
      error: string | null;
    },
  ) {
    super(channelId);
  }
}

export class ChannelStatusChangedEvent extends DomainEvent {
  static readonly eventName = 'channel.status.changed.v1';
  readonly eventName = ChannelStatusChangedEvent.eventName;

  constructor(
    channelId: string,
    readonly tenantId: string,
    readonly status: ChannelStatus,
    readonly previousStatus: ChannelStatus,
  ) {
    super(channelId);
  }
}

/** Canal removido. O conector apaga a sessão guardada; outros módulos podem arquivar dados. */
export class ChannelRemovedEvent extends DomainEvent {
  static readonly eventName = 'channel.removed.v1';
  readonly eventName = ChannelRemovedEvent.eventName;

  constructor(
    channelId: string,
    readonly tenantId: string,
    readonly provider: ChannelProvider,
  ) {
    super(channelId);
  }
}
