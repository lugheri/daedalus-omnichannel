import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { ChannelNotConnectedError } from './errors/channel-not-connected.error';
import { ChannelStillActiveError } from './errors/channel-still-active.error';
import { InvalidChannelNameError } from './errors/invalid-channel-name.error';
import { ChannelRemovedEvent, ChannelStatusChangedEvent } from './events/channel-events';

/** Provedores de canal. Hoje só o WhatsApp não oficial (Baileys) — ADR 0006. */
export type ChannelProvider = 'whatsapp_baileys';

export type ChannelStatus =
  | 'pending' //      criado; o conector ainda não assumiu a sessão
  | 'awaiting_qr' //  esperando o QR code ser escaneado
  | 'connecting'
  | 'connected'
  | 'disconnected' // caiu; o conector tenta reconectar sozinho
  | 'logged_out'; //  pareamento desfeito; precisa de novo QR

const REMOVABLE = new Set<ChannelStatus>(['disconnected', 'logged_out']);

export interface ChannelProps {
  tenantId: string;
  provider: ChannelProvider;
  name: string;
  status: ChannelStatus;
  phoneNumber: string | null;
  statusReason: string | null;
  createdAt: Date;
  statusAt: Date;
}

/** Uma conexão de atendimento de um tenant (ex.: um número de WhatsApp). */
export class Channel extends AggregateRoot<ChannelProps> {
  static createWhatsApp(id: string, input: { tenantId: string; name: string }): Channel {
    const now = new Date();
    return new Channel(id, {
      tenantId: input.tenantId,
      provider: 'whatsapp_baileys',
      name: validName(input.name),
      status: 'pending',
      phoneNumber: null,
      statusReason: null,
      createdAt: now,
      statusAt: now,
    });
  }

  static restore(id: string, props: ChannelProps): Channel {
    return new Channel(id, props);
  }

  /**
   * Aplica um relato de status do conector. Relatos chegam por fila e podem
   * chegar fora de ordem: um relato mais antigo que o status atual é ignorado.
   * Devolve se algo mudou.
   */
  applyConnectionStatus(report: {
    status: ChannelStatus;
    phoneNumber: string | null;
    reason: string | null;
    at: Date;
  }): boolean {
    if (report.at < this.props.statusAt) return false;

    const previous = this.props.status;
    this.props.status = report.status;
    this.props.statusReason = report.reason;
    this.props.statusAt = report.at;
    if (report.phoneNumber) this.props.phoneNumber = report.phoneNumber;

    if (previous !== report.status) {
      this.addEvent(
        new ChannelStatusChangedEvent(this.id, this.props.tenantId, report.status, previous),
      );
    }
    return true;
  }

  assertCanSend(): void {
    if (this.props.status !== 'connected') throw new ChannelNotConnectedError();
  }

  /**
   * Marca o canal para remoção. Só canais parados: um canal conectado (ou no
   * meio do pareamento) precisa ser desconectado antes — evita apagar por
   * engano um número em atendimento.
   */
  remove(): void {
    if (!REMOVABLE.has(this.props.status)) throw new ChannelStillActiveError();
    this.addEvent(new ChannelRemovedEvent(this.id, this.props.tenantId, this.props.provider));
  }

  get tenantId() {
    return this.props.tenantId;
  }

  get provider() {
    return this.props.provider;
  }

  get name() {
    return this.props.name;
  }

  get status() {
    return this.props.status;
  }

  get phoneNumber() {
    return this.props.phoneNumber;
  }

  get statusReason() {
    return this.props.statusReason;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get statusAt() {
    return this.props.statusAt;
  }
}

function validName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > 60) throw new InvalidChannelNameError();
  return name;
}
