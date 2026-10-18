import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { ChannelActionUnsupportedError } from './errors/channel-action-unsupported.error';
import { ChannelNotConnectedError } from './errors/channel-not-connected.error';
import { ChannelStillActiveError } from './errors/channel-still-active.error';
import { InvalidChannelNameError } from './errors/invalid-channel-name.error';
import { InvalidWebChatSettingsError } from './errors/invalid-web-chat-settings.error';
import { ChannelRemovedEvent, ChannelStatusChangedEvent } from './events/channel-events';

/**
 * Tipos de canal: o WhatsApp não oficial (Baileys, ADR 0006) e o chat do site
 * (widget no site da conta, ADR 0012).
 */
export type ChannelProvider = 'whatsapp_baileys' | 'web_chat';

/** O que o visitante vê no widget do chat do site. */
export interface WebChatSettings {
  /** Cabeçalho do widget ("Fale com a gente"). */
  title: string;
  /** Primeira mensagem, antes de o visitante escrever. */
  greeting: string;
  /** Cor do botão e do cabeçalho (#rrggbb). */
  color: string;
}

export const DEFAULT_WEB_CHAT_SETTINGS: WebChatSettings = {
  title: 'Fale com a gente',
  greeting: 'Olá! Como podemos ajudar?',
  color: '#2f5bd7',
};

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
  /** Equipe que recebe as conversas novas do canal; null = fila geral. */
  teamId: string | null;
  createdAt: Date;
  statusAt: Date;
  /** Chat do site: chave pública do widget (vai no HTML do site). */
  publicKey: string | null;
  /** Chat do site: título, saudação e cor do widget. */
  settings: WebChatSettings | null;
}

/**
 * Uma conexão de atendimento de um tenant: um número de WhatsApp ou o chat do
 * site. O status do chat do site é só ligado (`connected`) ou desligado
 * (`disconnected`) — não há sessão nem QR code.
 */
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
      teamId: null,
      createdAt: now,
      statusAt: now,
      publicKey: null,
      settings: null,
    });
  }

  /** Chat do site: já nasce ligado, com a chave do widget e as configurações padrão. */
  static createWebChat(
    id: string,
    input: { tenantId: string; name: string; publicKey: string },
  ): Channel {
    const now = new Date();
    return new Channel(id, {
      tenantId: input.tenantId,
      provider: 'web_chat',
      name: validName(input.name),
      status: 'connected',
      phoneNumber: null,
      statusReason: null,
      teamId: null,
      createdAt: now,
      statusAt: now,
      publicKey: input.publicKey,
      settings: { ...DEFAULT_WEB_CHAT_SETTINGS },
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

  get isWebChat(): boolean {
    return this.props.provider === 'web_chat';
  }

  assertWhatsApp(): void {
    if (this.isWebChat) throw new ChannelActionUnsupportedError('CHANNEL_NOT_WHATSAPP');
  }

  assertWebChat(): void {
    if (!this.isWebChat) throw new ChannelActionUnsupportedError('CHANNEL_NOT_WEB_CHAT');
  }

  /** Liga ou desliga o chat do site (desligado, o widget some do site). */
  setWebChatEnabled(enabled: boolean, at: Date): void {
    this.assertWebChat();
    this.applyConnectionStatus({
      status: enabled ? 'connected' : 'disconnected',
      phoneNumber: null,
      reason: null,
      at,
    });
  }

  /** Atualiza só o que veio; o resultado inteiro é validado. */
  updateWebChatSettings(changes: Partial<WebChatSettings>): void {
    this.assertWebChat();
    this.props.settings = validSettings({
      ...(this.props.settings ?? DEFAULT_WEB_CHAT_SETTINGS),
      ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)),
    });
  }

  /** Chave nova: o widget com a antiga para de funcionar (sites publicados precisam republicar). */
  rotatePublicKey(publicKey: string): void {
    this.assertWebChat();
    this.props.publicKey = publicKey;
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

  /** Quem existe como equipe, o use case confere (módulo teams). */
  setTeam(teamId: string | null): void {
    this.props.teamId = teamId;
  }

  get teamId() {
    return this.props.teamId;
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

  get publicKey() {
    return this.props.publicKey;
  }

  get settings() {
    return this.props.settings;
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/;

function validSettings(input: WebChatSettings): WebChatSettings {
  const title = input.title.trim();
  if (!title || title.length > 60)
    throw new InvalidWebChatSettingsError('CHANNEL_INVALID_CHAT_TITLE');
  const greeting = input.greeting.trim();
  if (greeting.length > 300) throw new InvalidWebChatSettingsError('CHANNEL_INVALID_CHAT_GREETING');
  const color = input.color.trim().toLowerCase();
  if (!HEX_COLOR.test(color)) throw new InvalidWebChatSettingsError('CHANNEL_INVALID_CHAT_COLOR');
  return { title, greeting, color };
}

function validName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > 60) throw new InvalidChannelNameError();
  return name;
}
