import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidMessageTextError } from './errors/invalid-message-text.error';
import { ConversationMessageStatusChangedEvent } from './events/conversation-events';

export type MessageDirection =
  | 'inbound' //  do cliente para nós
  | 'outbound'; // de nós para o cliente (pelo sistema ou direto no celular)

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

export type MessageStatus =
  | 'received' // inbound
  | 'pending' //  outbound enfileirado, aguardando o canal
  | 'sent' //     outbound aceito pelo canal
  | 'failed'; //  outbound recusado (ver `error`)

/** Anexo no armazenamento (bucket privado). O arquivo só sai pela API. */
export interface MessageMedia {
  key: string;
  mimeType: string;
  size: number;
  fileName: string | null;
}

export interface MessageProps {
  tenantId: string;
  conversationId: string;
  channelId: string;
  direction: MessageDirection;
  kind: MessageKind;
  text: string | null;
  externalId: string | null;
  status: MessageStatus;
  /** Membro que enviou pelo sistema; null para recebidas e enviadas pelo celular. */
  senderMembershipId: string | null;
  /** Anexo, se houver (e se deu para baixar). */
  media: MessageMedia | null;
  error: string | null;
  sentAt: Date;
  createdAt: Date;
}

const MAX_TEXT = 4096;

/** Uma mensagem de uma conversa. Agregado próprio: conversas têm milhares delas. */
export class Message extends AggregateRoot<MessageProps> {
  /** Recebida do cliente pelo canal. */
  static inbound(
    id: string,
    input: Pick<
      MessageProps,
      'tenantId' | 'conversationId' | 'channelId' | 'kind' | 'text' | 'sentAt'
    > & { externalId: string; media?: MessageMedia | null },
  ): Message {
    return new Message(id, {
      ...input,
      media: input.media ?? null,
      direction: 'inbound',
      status: 'received',
      senderMembershipId: null,
      error: null,
      createdAt: new Date(),
    });
  }

  /** Enviada direto pelo celular conectado (fora do sistema): já saiu. */
  static sentFromPhone(
    id: string,
    input: Pick<
      MessageProps,
      'tenantId' | 'conversationId' | 'channelId' | 'kind' | 'text' | 'sentAt'
    > & { externalId: string; media?: MessageMedia | null },
  ): Message {
    return new Message(id, {
      ...input,
      media: input.media ?? null,
      direction: 'outbound',
      status: 'sent',
      senderMembershipId: null,
      error: null,
      createdAt: new Date(),
    });
  }

  /** Resposta de um membro pelo sistema: pendente até o canal confirmar. */
  static outbound(
    id: string,
    input: Pick<MessageProps, 'tenantId' | 'conversationId' | 'channelId'> & {
      text: string;
      senderMembershipId: string;
    },
  ): Message {
    const text = input.text.trim();
    if (text.length < 1 || text.length > MAX_TEXT) throw new InvalidMessageTextError();
    const now = new Date();
    return new Message(id, {
      ...input,
      text,
      direction: 'outbound',
      kind: 'text',
      externalId: null,
      status: 'pending',
      media: null,
      error: null,
      sentAt: now,
      createdAt: now,
    });
  }

  /**
   * Anexo enviado por um membro (já gravado no armazenamento), com legenda
   * opcional. Pendente até o canal confirmar, como o texto.
   */
  static outboundMedia(
    id: string,
    input: Pick<MessageProps, 'tenantId' | 'conversationId' | 'channelId'> & {
      kind: Exclude<MessageKind, 'text' | 'sticker' | 'location' | 'contact' | 'unsupported'>;
      media: MessageMedia;
      caption: string | null;
      senderMembershipId: string;
    },
  ): Message {
    const caption = input.caption?.trim() || null;
    if (caption && caption.length > MAX_TEXT) throw new InvalidMessageTextError();
    const now = new Date();
    return new Message(id, {
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      channelId: input.channelId,
      direction: 'outbound',
      kind: input.kind,
      text: caption,
      media: input.media,
      externalId: null,
      status: 'pending',
      senderMembershipId: input.senderMembershipId,
      error: null,
      sentAt: now,
      createdAt: now,
    });
  }

  static restore(id: string, props: MessageProps): Message {
    return new Message(id, props);
  }

  /**
   * Resultado do envio. Idempotente: só uma mensagem pendente muda — um
   * resultado repetido (ou atrasado) é ignorado. Devolve se mudou.
   */
  applySendResult(result: { externalId: string | null; error: string | null }): boolean {
    if (this.props.status !== 'pending') return false;
    if (result.error) {
      this.props.status = 'failed';
      this.props.error = result.error;
    } else {
      this.props.status = 'sent';
      this.props.externalId = result.externalId;
    }
    this.addEvent(
      new ConversationMessageStatusChangedEvent(
        this.props.conversationId,
        this.props.tenantId,
        this.id,
        this.props.status,
      ),
    );
    return true;
  }

  /** Texto curto para a lista de conversas (mídia: rótulo do tipo + legenda). */
  get preview(): string {
    const label = KIND_LABELS[this.props.kind];
    const text = this.props.text?.slice(0, 120);
    if (!label) return text ?? '';
    return text ? `${label}: ${text}` : label;
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get conversationId() {
    return this.props.conversationId;
  }
  get channelId() {
    return this.props.channelId;
  }
  get direction() {
    return this.props.direction;
  }
  get kind() {
    return this.props.kind;
  }
  get text() {
    return this.props.text;
  }
  get externalId() {
    return this.props.externalId;
  }
  get status() {
    return this.props.status;
  }
  get senderMembershipId() {
    return this.props.senderMembershipId;
  }
  get media() {
    return this.props.media;
  }
  get error() {
    return this.props.error;
  }
  get sentAt() {
    return this.props.sentAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}

const KIND_LABELS: Record<MessageKind, string> = {
  text: '',
  image: '📷 Imagem',
  video: '🎥 Vídeo',
  audio: '🎤 Áudio',
  document: '📄 Documento',
  sticker: 'Figurinha',
  location: '📍 Localização',
  contact: '👤 Contato',
  unsupported: 'Mensagem não suportada',
};
