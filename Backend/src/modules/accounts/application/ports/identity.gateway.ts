/**
 * O que o módulo accounts precisa do módulo identity, nos termos de accounts.
 * O adapter (infra/) traduz para a IdentityFacade. Assim, mudanças no
 * identity param no adapter, e os use cases são testados com um fake simples.
 */
export interface IdentityGateway {
  /** Lança erro de domínio do identity (e-mail em uso, senha fraca, nome vazio...). */
  registerUser(input: { email: string; name: string; password: string }): Promise<{ id: string }>;
  /** Lança erro 401 se as credenciais não conferirem. */
  authenticate(input: { email: string; password: string }): Promise<{ id: string }>;
  findUser(id: string): Promise<UserInfo | null>;
  findUserByEmail(email: string): Promise<UserInfo | null>;
  findUsers(ids: string[]): Promise<UserInfo[]>;
  startSession(input: {
    userId: string;
    tenantId: string;
    membershipId: string;
  }): Promise<SessionTokens>;
  /** Derruba as sessões de um vínculo desativado. */
  revokeMembershipSessions(membershipId: string): Promise<void>;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export const IDENTITY_GATEWAY = Symbol('IdentityGateway');
