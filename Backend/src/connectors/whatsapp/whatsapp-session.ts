import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  type ConnectionState,
  type WAMessage,
  type WASocket,
} from 'baileys';
import type { ILogger } from 'baileys/lib/Utils/logger';
import type { WhatsAppConnectionStatus } from '../../contracts/whatsapp-connector.contract';
import type { StoredAuthState } from './auth-state.store';
import { jidOf, normalizeMessage, phoneOf, type NormalizedMessage } from './message-normalizer';

/** O que a sessão precisa do mundo externo (injetado pelo SessionManager). */
export interface SessionHooks {
  loadAuthState(): Promise<StoredAuthState>;
  clearAuthState(): Promise<void>;
  onStatus(
    status: WhatsAppConnectionStatus,
    details?: { phoneNumber?: string | null; reason?: string | null },
  ): Promise<void>;
  onQrCode(qr: string | null): Promise<void>;
  onMessage(message: NormalizedMessage): Promise<void>;
  /** A sessão desistiu sozinha (logout pelo celular, QR não escaneado): não reconectar. */
  onGaveUp(): Promise<void>;
  logger: ILogger;
}

/** Sem escanear o QR por este tempo, a sessão desiste (evita gerar QR para sempre). */
const QR_TIMEOUT_MS = 3 * 60_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Uma conexão viva com o WhatsApp (um número), via Baileys.
 *
 * - Sem pareamento: publica QR codes até ser escaneado (ou desiste em 3 min).
 * - Queda: reconecta sozinha, com espera crescente (1 s, 2 s, 4 s... até 1 min).
 * - Logout (pelo celular ou por nós): apaga o estado e não reconecta.
 */
export class WhatsAppSession {
  private socket?: WASocket;
  private stopped = false;
  private connected = false;
  private attempt = 0;
  private qrStartedAt: number | null = null;
  private lastStatus: WhatsAppConnectionStatus | null = null;
  private reconnectTimer?: NodeJS.Timeout;
  /** Ids das mensagens enviadas por nós — o WhatsApp as devolve como "fromMe". */
  private readonly sentByUs = new Set<string>();

  constructor(
    readonly channelId: string,
    readonly tenantId: string,
    private readonly hooks: SessionHooks,
  ) {}

  get isConnected(): boolean {
    return this.connected;
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.status('connecting');
    await this.connect();
  }

  /** Encerra a conexão. Com `logout`, desfaz o pareamento no celular também. */
  async stop(options: { logout: boolean }): Promise<void> {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    const socket = this.socket;
    this.socket = undefined;
    this.connected = false;

    if (options.logout) {
      await socket?.logout().catch(() => undefined);
      await this.hooks.clearAuthState();
      await this.hooks.onQrCode(null);
      await this.status('logged_out', { reason: 'requested' });
    } else {
      void socket?.end(undefined);
    }
  }

  async sendText(to: string, text: string): Promise<string> {
    const socket = this.socket;
    if (!socket || !this.connected) throw new Error('Session is not connected');

    const jid = jidOf(to);
    const [check] = (await socket.onWhatsApp(jid)) ?? [];
    if (!check?.exists) throw new Error('not_on_whatsapp');

    const sent = await socket.sendMessage(check.jid, { text });
    const id = sent?.key.id;
    if (!id) throw new Error('send_failed');
    this.rememberSent(id);
    return id;
  }

  private async connect(): Promise<void> {
    const auth = await this.hooks.loadAuthState();
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    const socket = makeWASocket({
      version,
      auth: {
        creds: auth.state.creds,
        keys: makeCacheableSignalKeyStore(auth.state.keys, this.hooks.logger),
      },
      logger: this.hooks.logger,
      browser: Browsers.ubuntu('Omnichannel'),
      // Não marcar como "online": o celular continua recebendo notificações.
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    this.socket = socket;

    socket.ev.on('creds.update', () => void auth.saveCreds());
    socket.ev.on('connection.update', (update) => void this.onConnectionUpdate(socket, update));
    socket.ev.on('messages.upsert', ({ messages }) => void this.onMessages(messages));
  }

  private async onConnectionUpdate(
    socket: WASocket,
    update: Partial<ConnectionState>,
  ): Promise<void> {
    if (socket !== this.socket) return; // evento de um socket antigo

    if (update.qr) {
      this.qrStartedAt ??= Date.now();
      if (this.qrExpired()) return this.giveUp('disconnected', 'qr_timeout');
      await this.hooks.onQrCode(update.qr);
      await this.status('awaiting_qr');
    }

    if (update.connection === 'open') {
      this.connected = true;
      this.attempt = 0;
      this.qrStartedAt = null;
      await this.hooks.onQrCode(null);
      await this.status('connected', {
        phoneNumber: phoneOf(socket.user?.phoneNumber) ?? phoneOf(socket.user?.id),
      });
    }

    if (update.connection === 'close') {
      this.connected = false;
      if (this.stopped) return;
      await this.onClose(statusCodeOf(update.lastDisconnect?.error));
    }
  }

  private async onClose(code: number | undefined): Promise<void> {
    const reason = DisconnectReason[code ?? -1] ?? `code_${code ?? 'unknown'}`;

    if (code === DisconnectReason.loggedOut) {
      // Desconectado pelo celular (ou sessão invalidada): precisa de novo QR.
      await this.hooks.clearAuthState();
      return this.giveUp('logged_out', reason);
    }
    if (this.qrExpired()) return this.giveUp('disconnected', 'qr_timeout');
    if (code === DisconnectReason.connectionReplaced) {
      // Outro cliente assumiu este número (pode ser outra instância): não brigar.
      return this.giveUp('disconnected', reason);
    }

    // Reconecta na hora quando é o fluxo normal: logo após escanear o QR
    // (restartRequired) ou ao fim de um ciclo de QR codes ainda no prazo.
    const immediate = code === DisconnectReason.restartRequired || this.qrStartedAt !== null;
    const delay = immediate ? 0 : Math.min(1_000 * 2 ** this.attempt++, MAX_BACKOFF_MS);
    if (delay > 0) await this.status('disconnected', { reason });
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private qrExpired(): boolean {
    return this.qrStartedAt !== null && Date.now() - this.qrStartedAt > QR_TIMEOUT_MS;
  }

  /** Encerra de vez: não reconecta até um novo comando de conectar. */
  private async giveUp(status: WhatsAppConnectionStatus, reason: string): Promise<void> {
    this.stopped = true;
    this.connected = false;
    const socket = this.socket;
    this.socket = undefined;
    void socket?.end(undefined);
    await this.hooks.onQrCode(null);
    await this.status(status, { reason });
    await this.hooks.onGaveUp();
  }

  private async onMessages(messages: WAMessage[]): Promise<void> {
    for (const raw of messages) {
      if (raw.key.id && this.sentByUs.delete(raw.key.id)) continue;
      const message = normalizeMessage(raw);
      if (message) await this.hooks.onMessage(message);
    }
  }

  private async status(
    status: WhatsAppConnectionStatus,
    details?: { phoneNumber?: string | null; reason?: string | null },
  ): Promise<void> {
    // Só relata mudanças (o QR, por exemplo, se renova a cada ~20 s).
    if (status === this.lastStatus && status !== 'connected') return;
    this.lastStatus = status;
    await this.hooks.onStatus(status, details);
  }

  private rememberSent(id: string): void {
    this.sentByUs.add(id);
    if (this.sentByUs.size > 500) this.sentByUs.delete(this.sentByUs.values().next().value!);
  }
}

/** O Baileys encerra com um erro `Boom`, que traz o motivo em `output.statusCode`. */
function statusCodeOf(error: unknown): number | undefined {
  return (error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
}
