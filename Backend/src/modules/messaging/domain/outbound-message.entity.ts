import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidOutboundMessageError } from './errors/invalid-outbound-message.error';
import type { MessagingChannel } from './messaging-provider.entity';

export type OutboundStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';

/** Ordem do status: só avança. failed/bounced são finais. */
const RANK: Record<OutboundStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  failed: 3,
  bounced: 3,
};

export const MAX_SUBJECT = 200;
export const MAX_EMAIL_BODY = 20_000;
/** 10 segmentos de SMS (o provedor cobra por segmento). */
export const MAX_SMS_BODY = 1_600;

export interface OutboundMessageProps {
  tenantId: string;
  channel: MessagingChannel;
  contactId: string;
  to: string;
  subject: string | null;
  body: string;
  status: OutboundStatus;
  error: string | null;
  providerMessageId: string | null;
  sentByMembershipId: string | null;
  campaignId: string | null;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  updatedAt: Date;
}

/**
 * E-mail ou SMS para um contato. Nasce na fila; o worker entrega ao provedor
 * e os avisos do provedor (webhooks) atualizam até "entregue" ou "falhou".
 */
export class OutboundMessage extends AggregateRoot<OutboundMessageProps> {
  static compose(
    id: string,
    input: Pick<
      OutboundMessageProps,
      'tenantId' | 'channel' | 'contactId' | 'to' | 'sentByMembershipId' | 'campaignId'
    > & { subject?: string | null; body: string },
  ): OutboundMessage {
    const body = input.body.trim();
    let subject: string | null = null;
    if (input.channel === 'email') {
      subject = input.subject?.trim().replace(/\s+/g, ' ') ?? '';
      if (subject.length === 0 || subject.length > MAX_SUBJECT) {
        throw new InvalidOutboundMessageError('MESSAGING_INVALID_SUBJECT');
      }
    }
    const max = input.channel === 'email' ? MAX_EMAIL_BODY : MAX_SMS_BODY;
    if (body.length === 0 || body.length > max) {
      throw new InvalidOutboundMessageError('MESSAGING_INVALID_BODY');
    }
    const now = new Date();
    return new OutboundMessage(id, {
      ...input,
      subject,
      body,
      status: 'queued',
      error: null,
      providerMessageId: null,
      createdAt: now,
      sentAt: null,
      deliveredAt: null,
      updatedAt: now,
    });
  }

  static restore(id: string, props: OutboundMessageProps): OutboundMessage {
    return new OutboundMessage(id, props);
  }

  /** O provedor aceitou o envio. */
  markSent(providerMessageId: string | null): void {
    if (!this.advance('sent')) return;
    this.props.providerMessageId = providerMessageId ?? this.props.providerMessageId;
    this.props.sentAt = new Date();
    this.props.error = null;
  }

  /** Recusado (pelo provedor ou por regra nossa, ex.: descadastrado). Final. */
  markFailed(error: string): void {
    if (!this.advance('failed')) return;
    this.props.error = error.slice(0, 500);
  }

  /** Tentativa sem sucesso que vai ser repetida: continua na fila, com o motivo. */
  noteRetry(error: string): void {
    if (this.props.status !== 'queued') return;
    this.props.error = error.slice(0, 500);
    this.props.updatedAt = new Date();
  }

  /**
   * Aviso do provedor. Idempotente e fora de ordem: só avança (um "enviado"
   * que chega depois do "entregue" é ignorado). Devolve se mudou.
   */
  applyProviderStatus(status: Exclude<OutboundStatus, 'queued'>, error?: string | null): boolean {
    const changed = this.advance(status);
    if (!changed) return false;
    if (status === 'delivered') this.props.deliveredAt = new Date();
    if (status === 'sent') this.props.sentAt ??= new Date();
    if ((status === 'failed' || status === 'bounced') && error) {
      this.props.error = error.slice(0, 500);
    }
    return true;
  }

  get isFinal(): boolean {
    return RANK[this.props.status] === RANK.failed;
  }

  private advance(status: OutboundStatus): boolean {
    const current = this.props.status;
    if (current === status || RANK[current] === RANK.failed) return false;
    // "bounced" pode vir depois de "delivered" (devolução tardia); o resto só avança.
    if (RANK[status] < RANK[current]) return false;
    this.props.status = status;
    this.props.updatedAt = new Date();
    return true;
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get channel() {
    return this.props.channel;
  }
  get contactId() {
    return this.props.contactId;
  }
  get to() {
    return this.props.to;
  }
  get subject() {
    return this.props.subject;
  }
  get body() {
    return this.props.body;
  }
  get status() {
    return this.props.status;
  }
  get error() {
    return this.props.error;
  }
  get providerMessageId() {
    return this.props.providerMessageId;
  }
  get sentByMembershipId() {
    return this.props.sentByMembershipId;
  }
  get campaignId() {
    return this.props.campaignId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get sentAt() {
    return this.props.sentAt;
  }
  get deliveredAt() {
    return this.props.deliveredAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
