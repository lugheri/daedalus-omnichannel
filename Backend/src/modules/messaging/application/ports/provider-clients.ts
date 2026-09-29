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
  send(
    settings: SmsSettings,
    secret: string,
    message: { to: string; body: string },
  ): Promise<ProviderReceipt>;
}

/** Um cliente por provedor; o provedor de SMS futuro entra aqui como mais um. */
export interface ProviderClients {
  email(provider: EmailSettings['provider']): EmailProviderClient;
  sms(provider: SmsSettings['provider']): SmsProviderClient;
}

export const PROVIDER_CLIENTS = Symbol('ProviderClients');
