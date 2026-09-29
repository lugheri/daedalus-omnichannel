import type { EmailSettings, SmsSettings } from '../../domain/messaging-provider.entity';

/** Resultado de um envio aceito pelo provedor. */
export interface ProviderReceipt {
  /** Id da mensagem no provedor (para casar os avisos de entrega), se ele devolver. */
  providerMessageId: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Cabeçalhos extras (ex.: List-Unsubscribe). */
  headers?: Record<string, string>;
  /** Voltam em cada aviso de entrega (ex.: nosso id da mensagem). */
  customArgs?: Record<string, string>;
}

/**
 * Cliente HTTP de um provedor de e-mail. Lança ProviderRejectedError (o
 * provedor recusou: não adianta repetir) ou ProviderUnavailableError (fora do
 * ar / tempo esgotado: vale tentar de novo).
 */
export interface EmailProviderClient {
  send(settings: EmailSettings, secret: string, message: EmailMessage): Promise<ProviderReceipt>;
}

export interface SmsProviderClient {
  send(settings: SmsSettings, secret: string, message: SmsMessage): Promise<ProviderReceipt>;
}

export interface SmsMessage {
  to: string;
  body: string;
  /** Onde o provedor avisa as mudanças de status (só com URL pública). */
  statusCallbackUrl?: string;
}

/** Um cliente por provedor; o provedor de SMS futuro entra aqui como mais um. */
export interface ProviderClients {
  email(provider: EmailSettings['provider']): EmailProviderClient;
  sms(provider: SmsSettings['provider']): SmsProviderClient;
}

export const PROVIDER_CLIENTS = Symbol('ProviderClients');
