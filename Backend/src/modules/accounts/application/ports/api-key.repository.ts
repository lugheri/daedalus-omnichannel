import type { ApiKey } from '../../domain/api-key.entity';

/**
 * No accounts o `tenantId` é explícito (ver MembershipRepository). A busca por
 * id sem tenant existe só para AUTENTICAR a chave — é ela que diz o tenant.
 */
export interface ApiKeyRepository {
  save(key: ApiKey): Promise<void>;
  findInTenant(tenantId: string, id: string): Promise<ApiKey | null>;
  /** Só para autenticação (o id vem da própria chave apresentada). */
  findForAuthentication(id: string): Promise<ApiKey | null>;
  /** Mais recentes primeiro (inclui revogadas, para histórico). */
  listByTenant(tenantId: string): Promise<ApiKey[]>;
}

export const API_KEY_REPOSITORY = Symbol('ApiKeyRepository');
