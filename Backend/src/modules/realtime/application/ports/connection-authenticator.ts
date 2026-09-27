/**
 * Quem está abrindo a conexão em tempo real, a partir do access token. Mesmas
 * regras do HTTP (token válido, sessão não revogada, vínculo ativo, conta não
 * suspensa). Adapter em infra/ sobre as facades de identity e accounts.
 */
export interface ConnectionIdentity {
  tenantId: string;
  membershipId: string;
  permissions: readonly string[];
  /** Equipes do membro (salas de equipe). */
  teamIds: readonly string[];
  /** A conexão cai quando o token expira; o cliente reconecta com um novo. */
  expiresAt: Date;
}

export interface ConnectionAuthenticator {
  /** Lança erro de domínio 401 se o token (ou o acesso) não valer. */
  authenticate(token: string | undefined): Promise<ConnectionIdentity>;
}

export const CONNECTION_AUTHENTICATOR = Symbol('ConnectionAuthenticator');
