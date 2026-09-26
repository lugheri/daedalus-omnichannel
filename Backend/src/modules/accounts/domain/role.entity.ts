import { Entity } from '../../../shared/domain/entity';
import type { RoleTemplate, SystemRoleKey } from './default-roles';
import type { Permission } from './permissions';

export interface RoleProps {
  tenantId: string;
  /** Preenchido nos cargos criados a partir dos padrões; null nos personalizados. */
  key: SystemRoleKey | null;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
}

/** Cargo (RBAC), por tenant. Define o que um membro pode fazer. */
export class Role extends Entity<RoleProps> {
  static fromTemplate(id: string, tenantId: string, template: RoleTemplate): Role {
    return new Role(id, {
      tenantId,
      key: template.key,
      name: template.name,
      permissions: [...template.permissions],
      isSystem: template.isSystem,
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: RoleProps): Role {
    return new Role(id, props);
  }

  can(permission: Permission): boolean {
    return this.props.permissions.includes(permission);
  }

  get tenantId() {
    return this.props.tenantId;
  }

  get key() {
    return this.props.key;
  }

  get name() {
    return this.props.name;
  }

  get permissions(): readonly Permission[] {
    return this.props.permissions;
  }

  get isSystem() {
    return this.props.isSystem;
  }

  get createdAt() {
    return this.props.createdAt;
  }
}
