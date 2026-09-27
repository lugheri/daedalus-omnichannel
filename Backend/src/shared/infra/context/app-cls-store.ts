import type { ClsStore } from 'nestjs-cls';
import type { Actor } from '../../application/actor-context';

/**
 * Tudo que fica guardado no contexto de uma operação (requisição, job...).
 * O id do próprio contexto (`cls.getId()`) é o correlation id.
 */
export interface AppClsStore extends ClsStore {
  /** Quem fez a requisição (HTTP autenticado). */
  actor?: Actor;
  /** Tenant de operações sem ator — jobs e eventos processados pelo worker. */
  tenantId?: string;
}
