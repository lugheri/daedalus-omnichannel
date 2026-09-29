/** Endereços públicos que o módulo monta (links e webhooks). */
export interface MessagingUrls {
  /** Base pública da API, sem barra no fim. */
  publicApiUrl: string;
  /**
   * Os provedores conseguem chamar a API? (https, fora de localhost). Sem
   * isso, não pedimos avisos de entrega — o envio funciona do mesmo jeito.
   */
  webhooksReachable: boolean;
}

export const MESSAGING_URLS = Symbol('MessagingUrls');

export const webhookPaths = {
  twilioStatus: (providerId: string) => `/v1/public/webhooks/twilio/${providerId}/status`,
  twilioInbound: (providerId: string) => `/v1/public/webhooks/twilio/${providerId}/inbound`,
  sendgridEvents: (providerId: string) => `/v1/public/webhooks/sendgrid/${providerId}`,
  unsubscribe: (token: string) => `/v1/public/unsubscribe/${token}`,
};
