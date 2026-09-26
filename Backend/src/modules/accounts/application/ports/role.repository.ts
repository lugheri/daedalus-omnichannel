import type { Role } from '../../domain/role.entity';

export interface RoleRepository {
  saveMany(roles: Role[]): Promise<void>;
}

export const ROLE_REPOSITORY = Symbol('RoleRepository');
