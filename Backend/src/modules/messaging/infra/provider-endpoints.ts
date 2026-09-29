/** Endereços das APIs dos provedores (o módulo os lê da configuração). */
export interface ProviderEndpoints {
  sendgridApiUrl: string;
  twilioApiUrl: string;
}

export const PROVIDER_ENDPOINTS = Symbol('ProviderEndpoints');
