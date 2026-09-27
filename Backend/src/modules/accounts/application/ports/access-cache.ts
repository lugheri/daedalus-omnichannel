import type { AccountAccess } from '../account-access';

/**
 * Cache do acesso resolvido, por vínculo (membership). Evita 3 consultas ao
 * banco em toda requisição. Validade curta: mesmo sem invalidação explícita,
 * uma mudança de cargo ou desativação vale em no máximo alguns segundos.
 * Quem muda cargo/vínculo/status da conta chama `invalidate`.
 */
export interface AccessCache {
  get(membershipId: string): Promise<AccountAccess | null>;
  set(access: AccountAccess): Promise<void>;
  invalidate(membershipIds: string[]): Promise<void>;
}

export const ACCESS_CACHE = Symbol('AccessCache');
