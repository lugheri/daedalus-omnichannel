import type { Membership } from '../../domain/membership.entity';

/**
 * No módulo accounts o `tenantId` é explícito (ele é a ORIGEM do tenant, e o
 * aceite de convite acontece sem ator logado). O valor vem SEMPRE do ator
 * autenticado ou de um convite validado — nunca do cliente.
 */
export interface MembershipRepository {
  save(membership: Membership): Promise<void>;
  /** Busca direta pelo id (o id vem do access token já validado). */
  findById(id: string): Promise<Membership | null>;
  findInTenant(tenantId: string, id: string): Promise<Membership | null>;
  findByUser(tenantId: string, userId: string): Promise<Membership | null>;
  listByTenant(tenantId: string): Promise<Membership[]>;
  /** Quantos vínculos ATIVOS usam o cargo (ex.: garantir que sobra um Owner). */
  countActiveWithRole(tenantId: string, roleId: string): Promise<number>;
  /** Ids de todos os vínculos (qualquer status) com o cargo. */
  listIdsWithRole(tenantId: string, roleId: string): Promise<string[]>;
  /**
   * Vínculos ativos de um usuário em TODOS os tenants. Exceção consciente à
   * regra do filtro por tenant: no login ainda não há tenant escolhido —
   * é justamente esta consulta que diz em quais ele pode entrar.
   */
  findActiveByUserId(userId: string): Promise<Membership[]>;
}

export const MEMBERSHIP_REPOSITORY = Symbol('MembershipRepository');
