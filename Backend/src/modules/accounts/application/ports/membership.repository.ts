import type { Membership } from '../../domain/membership.entity';

export interface MembershipRepository {
  save(membership: Membership): Promise<void>;
  /**
   * Vínculos ativos de um usuário em TODOS os tenants. Exceção consciente à
   * regra do filtro por tenant: no login ainda não há tenant escolhido —
   * é justamente esta consulta que diz em quais ele pode entrar.
   */
  findActiveByUserId(userId: string): Promise<Membership[]>;
}

export const MEMBERSHIP_REPOSITORY = Symbol('MembershipRepository');
