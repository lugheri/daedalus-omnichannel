import { Entity } from '../../../shared/domain/entity';
import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import { InvalidMessagingSettingsError } from './errors/invalid-messaging-settings.error';

export type MessagingChannel = 'email' | 'sms';
export const MESSAGING_CHANNELS: readonly MessagingChannel[] = ['email', 'sms'];

/** E-mail pelo SendGrid (o produto de e-mail da Twilio). */
export interface EmailSettings {
  provider: 'sendgrid';
  /** Remetente verificado no SendGrid (Sender Identity ou domínio autenticado). */
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  /**
   * Chave pública do Signed Event Webhook do SendGrid (não é segredo). Sem
   * ela, os avisos de entrega são recusados (não dá para confirmar a origem).
   */
  eventWebhookKey: string | null;
}

/** SMS pela Twilio: sai de um número OU de um Messaging Service. */
export interface SmsSettings {
  provider: 'twilio';
  accountSid: string;
  from: string | null;
  messagingServiceSid: string | null;
}

export type ProviderSettings = EmailSettings | SmsSettings;

export type ProviderStatus = 'unverified' | 'verified' | 'failing';

/** Segredo já cifrado (quem cifra é o use case, pelo port SecretCipher). */
export interface SealedSecret {
  sealed: string;
  /** Últimos 4 caracteres, para reconhecer qual chave está salva. */
  hint: string;
}

export interface MessagingProviderProps {
  tenantId: string;
  channel: MessagingChannel;
  settings: ProviderSettings;
  secret: SealedSecret;
  status: ProviderStatus;
  lastCheckedAt: Date | null;
  /** Mensagem do provedor no último teste que falhou (ajuda a corrigir a configuração). */
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_SID = /^AC[0-9a-f]{32}$/i;
const MESSAGING_SERVICE_SID = /^MG[0-9a-f]{32}$/i;
/** Chave pública EC em base64 (DER), como o SendGrid mostra. */
const WEBHOOK_KEY = /^[A-Za-z0-9+/]{80,600}={0,2}$/;

/**
 * Provedor de envio de um canal (e-mail ou SMS) de uma conta — no máximo um
 * por canal. As credenciais são do cliente; mudar a configuração volta o
 * status para "não verificado" até o próximo teste.
 */
export class MessagingProvider extends Entity<MessagingProviderProps> {
  static configure(
    id: string,
    input: { tenantId: string; settings: ProviderSettings; secret: SealedSecret },
  ): MessagingProvider {
    const now = new Date();
    const settings = validSettings(input.settings);
    return new MessagingProvider(id, {
      tenantId: input.tenantId,
      channel: channelOf(settings),
      settings,
      secret: input.secret,
      status: 'unverified',
      lastCheckedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: MessagingProviderProps): MessagingProvider {
    return new MessagingProvider(id, props);
  }

  /** Sem `secret`, mantém o salvo (a tela nunca recebe o segredo de volta). */
  reconfigure(settings: ProviderSettings, secret?: SealedSecret): void {
    const valid = validSettings(settings);
    if (channelOf(valid) !== this.props.channel) {
      throw new InvalidMessagingSettingsError('MESSAGING_INVALID_PROVIDER');
    }
    this.props.settings = valid;
    if (secret) this.props.secret = secret;
    this.props.status = 'unverified';
    this.props.lastError = null;
    this.props.updatedAt = new Date();
  }

  recordCheck(result: { ok: true } | { ok: false; error: string }): void {
    this.props.status = result.ok ? 'verified' : 'failing';
    this.props.lastError = result.ok ? null : result.error.slice(0, 500);
    this.props.lastCheckedAt = new Date();
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get channel() {
    return this.props.channel;
  }
  get settings(): ProviderSettings {
    return this.props.settings;
  }
  get secret(): SealedSecret {
    return this.props.secret;
  }
  get status() {
    return this.props.status;
  }
  get lastCheckedAt() {
    return this.props.lastCheckedAt;
  }
  get lastError() {
    return this.props.lastError;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}

export function channelOf(settings: ProviderSettings): MessagingChannel {
  return settings.provider === 'sendgrid' ? 'email' : 'sms';
}

/** E-mail válido e normalizado (minúsculas), ou null. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

function validSettings(settings: ProviderSettings): ProviderSettings {
  if (settings.provider === 'sendgrid') {
    const fromEmail = normalizeEmail(settings.fromEmail);
    if (!fromEmail) throw new InvalidMessagingSettingsError('MESSAGING_INVALID_FROM_EMAIL');
    const fromName = settings.fromName.trim().replace(/\s+/g, ' ');
    if (fromName.length === 0 || fromName.length > 100) {
      throw new InvalidMessagingSettingsError('MESSAGING_INVALID_FROM_NAME');
    }
    let replyTo: string | null = null;
    if (settings.replyTo?.trim()) {
      replyTo = normalizeEmail(settings.replyTo);
      if (!replyTo) throw new InvalidMessagingSettingsError('MESSAGING_INVALID_REPLY_TO');
    }
    const eventWebhookKey = settings.eventWebhookKey?.replace(/\s+/g, '') || null;
    if (eventWebhookKey && !WEBHOOK_KEY.test(eventWebhookKey)) {
      throw new InvalidMessagingSettingsError('MESSAGING_INVALID_WEBHOOK_KEY');
    }
    return { provider: 'sendgrid', fromEmail, fromName, replyTo, eventWebhookKey };
  }
  if (settings.provider === 'twilio') {
    const accountSid = settings.accountSid.trim();
    if (!ACCOUNT_SID.test(accountSid)) {
      throw new InvalidMessagingSettingsError('MESSAGING_INVALID_ACCOUNT_SID');
    }
    const serviceSid = settings.messagingServiceSid?.trim() || null;
    const rawFrom = settings.from?.trim() || null;
    // Exatamente um remetente: o número OU o Messaging Service.
    if ((serviceSid === null) === (rawFrom === null)) {
      throw new InvalidMessagingSettingsError('MESSAGING_INVALID_SENDER');
    }
    if (serviceSid && !MESSAGING_SERVICE_SID.test(serviceSid)) {
      throw new InvalidMessagingSettingsError('MESSAGING_INVALID_SENDER');
    }
    const from = rawFrom ? normalizePhoneNumber(rawFrom) : null;
    if (rawFrom && !from) throw new InvalidMessagingSettingsError('MESSAGING_INVALID_SENDER');
    return { provider: 'twilio', accountSid, from, messagingServiceSid: serviceSid };
  }
  throw new InvalidMessagingSettingsError('MESSAGING_INVALID_PROVIDER');
}

/** Formato mínimo do segredo (chave do SendGrid ou Auth Token da Twilio). */
export function assertValidSecret(secret: string): void {
  const value = secret.trim();
  if (value.length < 16 || value.length > 300 || /\s/.test(value)) {
    throw new InvalidMessagingSettingsError('MESSAGING_INVALID_SECRET');
  }
}
