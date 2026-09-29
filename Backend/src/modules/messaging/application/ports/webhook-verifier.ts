/** Confere que um webhook veio mesmo do provedor (assinatura). */
export interface WebhookVerifier {
  /**
   * Twilio: HMAC-SHA1 (Auth Token) da URL chamada + parâmetros POST
   * ordenados, em base64, no cabeçalho X-Twilio-Signature.
   */
  twilio(input: {
    url: string;
    params: Record<string, string>;
    signature: string | undefined;
    authToken: string;
  }): boolean;
  /**
   * SendGrid Signed Event Webhook: ECDSA (P-256, SHA-256) sobre timestamp +
   * corpo cru, com a chave pública da conta.
   */
  sendgrid(input: {
    publicKey: string;
    timestamp: string | undefined;
    signature: string | undefined;
    rawBody: Buffer;
  }): boolean;
}

export const WEBHOOK_VERIFIER = Symbol('WebhookVerifier');
