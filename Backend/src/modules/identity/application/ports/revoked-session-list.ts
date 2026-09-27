/**
 * Sessões revogadas cujos access tokens ainda podem estar em circulação.
 *
 * O access token é verificado sem consultar o banco; para que logout e
 * revogação por reuso valham na hora, a sessão entra nesta lista pelo
 * tempo de vida do access token — depois disso, todo token dela já expirou.
 */
export interface RevokedSessionList {
  add(sessionId: string, ttlSeconds: number): Promise<void>;
  has(sessionId: string): Promise<boolean>;
}

export const REVOKED_SESSION_LIST = Symbol('RevokedSessionList');
