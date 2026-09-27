import { Entity } from '../../../shared/domain/entity';
import type { RoleTemplate, SystemRoleKey } from './default-roles';
import { InvalidRoleError } from './errors/invalid-role.error';
import { SystemRoleImmutableError } from './errors/system-role-immutable.error';
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

/** Permissão exclusiva do Owner: nenhum outro cargo pode tê-la. */
const OWNER_ONLY: Permission = 'account:manage';

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

  /** Cargo criado pelo tenant. */
  static createCustom(
    id: string,
    input: { tenantId: string; name: string; permissions: Permission[] },
  ): Role {
    return new Role(id, {
      tenantId: input.tenantId,
      key: null,
      name: validName(input.name),
      permissions: validPermissions(input.permissions),
      isSystem: false,
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: RoleProps): Role {
    return new Role(id, props);
  }

  /** Edita nome e/ou permissões. Os cargos padrão (exceto Owner) também podem ser ajustados. */
  update(changes: { name?: string; permissions?: Permission[] }): void {
    if (this.props.isSystem) throw new SystemRoleImmutableError();
    if (changes.name !== undefined) this.props.name = validName(changes.name);
    if (changes.permissions !== undefined) {
      this.props.permissions = validPermissions(changes.permissions);
    }
  }

  /** Garante que o cargo pode ser excluído (quem checa se está em uso é o use case). */
  assertDeletable(): void {
    if (this.props.isSystem) throw new SystemRoleImmutableError();
  }

  can(permission: Permission): boolean {
    return this.props.permissions.includes(permission);
  }

  get isOwner(): boolean {
    return this.props.key === 'owner';
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

function validName(raw: string): string {
  const name = raw.trim();
  if (name.length < 2 || name.length > 50) {
    throw new InvalidRoleError('name must have between 2 and 50 characters');
  }
  return name;
}

function validPermissions(permissions: Permission[]): Permission[] {
  if (permissions.includes(OWNER_ONLY)) {
    throw new InvalidRoleError(`"${OWNER_ONLY}" is exclusive to the Owner role`);
  }
  return [...new Set(permissions)];
}
