import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidCampaignError } from './errors/invalid-campaign.error';
import type { MessagingChannel } from './messaging-provider.entity';
import { MAX_EMAIL_BODY, MAX_SUBJECT } from './outbound-message.entity';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'canceled';

/** Filtro do público (mesmos filtros da lista de contatos). */
export interface CampaignAudience {
  search?: string;
  source?: string;
  sourceDetail?: string;
}

/** Rodapé obrigatório dos SMS de campanha (descadastro, LGPD/boa prática). */
export const SMS_OPT_OUT_FOOTER = 'Para não receber mais, responda SAIR.';
/** O texto + rodapé cabem nos 1600 caracteres do SMS. */
export const MAX_CAMPAIGN_SMS_BODY = 1_600 - SMS_OPT_OUT_FOOTER.length - 2;
/** Agendamento: no máximo 90 dias à frente. */
export const MAX_SCHEDULE_DAYS = 90;

export interface CampaignProps {
  tenantId: string;
  name: string;
  channel: MessagingChannel;
  subject: string | null;
  body: string;
  audience: CampaignAudience;
  status: CampaignStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  /** Até onde o público já foi montado (id do último contato do lote). */
  audienceCursor: string | null;
  queuedCount: number;
  skippedNoAddress: number;
  skippedOptedOut: number;
  createdByMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Campanha de e-mail ou SMS para um público (filtro de contatos). Só se
 * edita enquanto é rascunho ou está agendada; ao começar, o público é
 * congelado (cada contato vira uma mensagem na fila de envio).
 */
export class Campaign extends AggregateRoot<CampaignProps> {
  static draft(
    id: string,
    input: Pick<CampaignProps, 'tenantId' | 'channel' | 'createdByMembershipId'> & {
      name: string;
      subject?: string | null;
      body: string;
      audience: CampaignAudience;
    },
  ): Campaign {
    const now = new Date();
    const campaign = new Campaign(id, {
      tenantId: input.tenantId,
      channel: input.channel,
      createdByMembershipId: input.createdByMembershipId,
      name: '',
      subject: null,
      body: '',
      audience: {},
      status: 'draft',
      scheduledAt: null,
      startedAt: null,
      finishedAt: null,
      audienceCursor: null,
      queuedCount: 0,
      skippedNoAddress: 0,
      skippedOptedOut: 0,
      createdAt: now,
      updatedAt: now,
    });
    campaign.edit(input);
    return campaign;
  }

  static restore(id: string, props: CampaignProps): Campaign {
    return new Campaign(id, props);
  }

  /** Conteúdo e público; só antes de começar. */
  edit(input: {
    name?: string;
    subject?: string | null;
    body?: string;
    audience?: CampaignAudience;
  }): void {
    this.assertEditable();
    if (input.name !== undefined) {
      const name = input.name.trim().replace(/\s+/g, ' ');
      if (name.length === 0 || name.length > 100) {
        throw new InvalidCampaignError('CAMPAIGN_INVALID_NAME');
      }
      this.props.name = name;
    }
    if (this.props.channel === 'email' && input.subject !== undefined) {
      const subject = input.subject?.trim().replace(/\s+/g, ' ') ?? '';
      if (subject.length === 0 || subject.length > MAX_SUBJECT) {
        throw new InvalidCampaignError('CAMPAIGN_INVALID_SUBJECT');
      }
      this.props.subject = subject;
    }
    if (input.body !== undefined) {
      const body = input.body.trim();
      const max = this.props.channel === 'email' ? MAX_EMAIL_BODY : MAX_CAMPAIGN_SMS_BODY;
      if (body.length === 0 || body.length > max) {
        throw new InvalidCampaignError('CAMPAIGN_INVALID_BODY');
      }
      this.props.body = body;
    }
    if (input.audience !== undefined) this.props.audience = tidyAudience(input.audience);
    this.props.updatedAt = new Date();
  }

  /** Agenda para `at`, ou (sem `at`) começa já. */
  schedule(at: Date | null, now = new Date()): void {
    this.assertEditable();
    if (this.props.channel === 'email' && !this.props.subject) {
      throw new InvalidCampaignError('CAMPAIGN_INVALID_SUBJECT');
    }
    if (at === null) {
      this.start(now);
      return;
    }
    const max = now.getTime() + MAX_SCHEDULE_DAYS * 24 * 3600_000;
    if (at.getTime() <= now.getTime() || at.getTime() > max) {
      throw new InvalidCampaignError('CAMPAIGN_INVALID_SCHEDULE');
    }
    this.props.status = 'scheduled';
    this.props.scheduledAt = at;
    this.props.updatedAt = now;
  }

  /** Volta de agendada para rascunho. */
  unschedule(): void {
    if (this.props.status !== 'scheduled') throw new InvalidCampaignError('CAMPAIGN_NOT_EDITABLE');
    this.props.status = 'draft';
    this.props.scheduledAt = null;
    this.props.updatedAt = new Date();
  }

  /** Agendada que venceu (varredura) ou "enviar agora". Idempotente. */
  start(now = new Date()): boolean {
    if (this.props.status === 'sending') return false;
    this.assertEditable();
    this.props.status = 'sending';
    this.props.startedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  /** Um lote do público montado: onde parou e o que foi pulado. */
  recordBatch(input: {
    cursor: string | null;
    queued: number;
    skippedNoAddress: number;
    skippedOptedOut: number;
  }): void {
    this.props.audienceCursor = input.cursor;
    this.props.queuedCount += input.queued;
    this.props.skippedNoAddress += input.skippedNoAddress;
    this.props.skippedOptedOut += input.skippedOptedOut;
    this.props.updatedAt = new Date();
  }

  /** Público inteiro montado e na fila de envio. */
  finish(): void {
    if (this.props.status !== 'sending') return;
    this.props.status = 'sent';
    this.props.finishedAt = new Date();
    this.props.updatedAt = this.props.finishedAt;
  }

  /** Para o que ainda não saiu (as mensagens na fila viram "falhou: cancelada"). */
  cancel(): void {
    // "sent" = público montado, mas as entregas saem no ritmo do canal (um SMS
    // por segundo pode levar horas): ainda dá para parar o que não saiu.
    // Rascunho não se cancela — exclui.
    if (this.props.status === 'draft' || this.props.status === 'canceled') {
      throw new InvalidCampaignError('CAMPAIGN_NOT_CANCELABLE');
    }
    this.props.status = 'canceled';
    this.props.finishedAt = new Date();
    this.props.updatedAt = this.props.finishedAt;
  }

  get isEditable(): boolean {
    return this.props.status === 'draft' || this.props.status === 'scheduled';
  }

  private assertEditable(): void {
    if (!this.isEditable) throw new InvalidCampaignError('CAMPAIGN_NOT_EDITABLE');
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get channel() {
    return this.props.channel;
  }
  get subject() {
    return this.props.subject;
  }
  get body() {
    return this.props.body;
  }
  get audience(): CampaignAudience {
    return this.props.audience;
  }
  get status() {
    return this.props.status;
  }
  get scheduledAt() {
    return this.props.scheduledAt;
  }
  get startedAt() {
    return this.props.startedAt;
  }
  get finishedAt() {
    return this.props.finishedAt;
  }
  get audienceCursor() {
    return this.props.audienceCursor;
  }
  get queuedCount() {
    return this.props.queuedCount;
  }
  get skippedNoAddress() {
    return this.props.skippedNoAddress;
  }
  get skippedOptedOut() {
    return this.props.skippedOptedOut;
  }
  get createdByMembershipId() {
    return this.props.createdByMembershipId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}

function tidyAudience(audience: CampaignAudience): CampaignAudience {
  const search = audience.search?.trim();
  const sourceDetail = audience.sourceDetail?.trim();
  return {
    ...(search && { search }),
    ...(audience.source && { source: audience.source }),
    ...(sourceDetail && { sourceDetail }),
  };
}
