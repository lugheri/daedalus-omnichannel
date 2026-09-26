/**
 * O que o módulo accounts precisa do módulo identity, nos termos de accounts.
 * O adapter (infra/) traduz para a IdentityFacade. Assim, mudanças no
 * identity param no adapter, e os use cases são testados com um fake simples.
 */
export interface IdentityGateway {
  /** Lança erro de domínio do identity (e-mail em uso, senha fraca...). */
  registerUser(input: { email: string; name: string; password: string }): Promise<{ id: string }>;
  /** Lança erro 401 se as credenciais não conferirem. */
  authenticate(input: { email: string; password: string }): Promise<{ id: string }>;
  startSession(input: {
    userId: string;
    tenantId: string;
    membershipId: string;
  }): Promise<SessionTokens>;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export const IDENTITY_GATEWAY = Symbol('IdentityGateway');
