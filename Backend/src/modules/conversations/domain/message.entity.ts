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
    > & { externalId: string },
  ): Message {
    return new Message(id, {
      ...input,
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
    > & { externalId: string },
  ): Message {
    return new Message(id, {
      ...input,
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

  /** Texto curto para a lista de conversas. */
  get preview(): string {
    if (this.props.text) return this.props.text.slice(0, 120);
    return KIND_LABELS[this.props.kind];
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
