import type { Role } from '../../domain/role.entity';

export interface RoleRepository {
  /** Lança `RoleNameTakenError` se já houver cargo com o mesmo nome no tenant. */
  save(role: Role): Promise<void>;
  saveMany(roles: Role[]): Promise<void>;
  /** Busca direta pelo id (usado na resolução de acesso, a partir do vínculo). */
  findById(id: string): Promise<Role | null>;
  findInTenant(tenantId: string, id: string): Promise<Role | null>;
  listByTenant(tenantId: string): Promise<Role[]>;
  delete(role: Role): Promise<void>;
}

export const ROLE_REPOSITORY = Symbol('RoleRepository');
