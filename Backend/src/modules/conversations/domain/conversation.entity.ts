import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  ConversationAssignedEvent,
  ConversationDispositionSetEvent,
  ConversationMessageAddedEvent,
  ConversationStartedEvent,
  ConversationStatusChangedEvent,
  ConversationTeamChangedEvent,
} from './events/conversation-events';
import { ConversationAlreadyAssignedError } from './errors/conversation-already-assigned.error';
import type { Message } from './message.entity';

export type ConversationStatus =
  | 'open' //     precisa de atenção do atendimento
  | 'pending' //  aguardando o cliente
  | 'resolved'; // encerrada (reabre sozinha se o cliente escrever)

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = ['open', 'pending', 'resolved'];

export interface ConversationProps {
  tenantId: string;
  channelId: string;
  contactId: string;
  status: ConversationStatus;
  assigneeId: string | null;
  /** Equipe da conversa (herdada do canal); null = fila geral. */
  teamId: string | null;
  /**
   * Tabulação do atendimento atual (a última dada). Volta a null quando o
   * cliente escreve numa conversa resolvida: é um atendimento novo.
   */
  dispositionId: string | null;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: Date;
}

/**
 * Conversa com um contato num canal — uma só por par (canal, contato), como
 * no próprio WhatsApp. Guarda o resumo que a caixa de entrada mostra (última
 * mensagem, não lidas); as mensagens são um agregado à parte.
 */
export class Conversation extends AggregateRoot<ConversationProps> {
  /**
   * Campos alterados desde que foi criada/carregada. O repositório grava só
   * estes: a conversa é escrita por processos diferentes ao mesmo tempo (o
   * worker grava a mensagem recebida, a API transfere ou tabula), e gravar a
   * linha inteira lida antes faria um desfazer o outro — ex.: a mensagem do
   * cliente devolvendo o responsável antigo de uma transferência recém-feita.
   */
  private readonly dirty = new Set<keyof ConversationProps>();

  static start(
    id: string,
    input: { tenantId: string; channelId: string; contactId: string; teamId: string | null },
  ): Conversation {
    const now = new Date();
    const conversation = new Conversation(id, {
      ...input,
      status: 'open',
      assigneeId: null,
      dispositionId: null,
      lastMessageAt: now,
      lastMessagePreview: null,
      unreadCount: 0,
      createdAt: now,
    });
    conversation.addEvent(
      new ConversationStartedEvent(
        id,
        input.tenantId,
        input.channelId,
        input.contactId,
        input.teamId,
      ),
    );
    return conversation;
  }

  static restore(id: string, props: ConversationProps): Conversation {
    return new Conversation(id, props);
  }

  /**
   * Registra uma mensagem na conversa:
   * - do cliente: conta como não lida e reabre a conversa, se estava parada;
   * - nossa pelo sistema: zera as não lidas e, sem responsável, quem
   *   respondeu assume a conversa;
   * - nossa pelo celular: só atualiza o resumo.
   */
  addMessage(message: Message): void {
    if (message.sentAt >= this.props.lastMessageAt || this.props.lastMessagePreview === null) {
      this.props.lastMessageAt = message.sentAt;
      this.props.lastMessagePreview = message.preview;
      this.touch('lastMessageAt', 'lastMessagePreview');
    }

    if (message.direction === 'inbound') {
      this.props.unreadCount += 1;
      this.touch('unreadCount');
      if (this.props.status !== 'open') this.changeStatus('open');
    } else if (message.senderMembershipId) {
      this.props.unreadCount = 0;
      this.touch('unreadCount');
      if (!this.props.assigneeId) this.assign(message.senderMembershipId);
    }

    this.addEvent(
      new ConversationMessageAddedEvent(
        this.id,
        this.props.tenantId,
        message.id,
        message.direction,
        this.props.assigneeId,
      ),
    );
  }

  changeStatus(status: ConversationStatus): void {
    const previous = this.props.status;
    if (previous === status) return;
    this.props.status = status;
    this.touch('status');
    // Resolvida e reaberta = atendimento novo, ainda sem tabulação.
    if (previous === 'resolved') {
      this.props.dispositionId = null;
      this.touch('dispositionId');
    }
    this.addEvent(
      new ConversationStatusChangedEvent(this.id, this.props.tenantId, status, previous),
    );
  }

  assign(assigneeId: string | null): void {
    const previous = this.props.assigneeId;
    if (previous === assigneeId) return;
    this.props.assigneeId = assigneeId;
    this.touch('assigneeId');
    this.addEvent(
      new ConversationAssignedEvent(this.id, this.props.tenantId, assigneeId, previous),
    );
  }

  /**
   * "Assumir": quem vê uma conversa sem responsável a pega para si. Com
   * responsável, só uma transferência (`assign`) muda de mão.
   */
  claim(membershipId: string): void {
    if (this.props.assigneeId === membershipId) return;
    if (this.props.assigneeId) throw new ConversationAlreadyAssignedError();
    this.assign(membershipId);
  }

  /** Muda a conversa de equipe. Quem existe como equipe, o use case confere. */
  moveToTeam(teamId: string | null): void {
    const previous = this.props.teamId;
    if (previous === teamId) return;
    this.props.teamId = teamId;
    this.touch('teamId');
    this.addEvent(new ConversationTeamChangedEvent(this.id, this.props.tenantId, teamId, previous));
  }

  /** Tabula o atendimento. Se a tabulação existe e está ativa, o use case confere. */
  setDisposition(dispositionId: string, membershipId: string): void {
    const previous = this.props.dispositionId;
    this.props.dispositionId = dispositionId;
    this.touch('dispositionId');
    this.addEvent(
      new ConversationDispositionSetEvent(
        this.id,
        this.props.tenantId,
        dispositionId,
        previous,
        membershipId,
      ),
    );
  }

  markRead(): void {
    this.props.unreadCount = 0;
    this.touch('unreadCount');
  }

  /** O que mudou desde que foi criada/carregada (ver `dirty`). */
  get changedFields(): ReadonlySet<keyof ConversationProps> {
    return this.dirty;
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get channelId() {
    return this.props.channelId;
  }
  get contactId() {
    return this.props.contactId;
  }
  get status() {
    return this.props.status;
  }
  get assigneeId() {
    return this.props.assigneeId;
  }
  get teamId() {
    return this.props.teamId;
  }
  get dispositionId() {
    return this.props.dispositionId;
  }
  get lastMessageAt() {
    return this.props.lastMessageAt;
  }
  get lastMessagePreview() {
    return this.props.lastMessagePreview;
  }
  get unreadCount() {
    return this.props.unreadCount;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  private touch(...fields: (keyof ConversationProps)[]): void {
    for (const field of fields) this.dirty.add(field);
  }
}
