import type {
  InvitationModel,
  MembershipModel,
  RoleModel,
  TenantModel,
} from '../../../shared/infra/prisma/generated/models';
import type { SystemRoleKey } from '../domain/default-roles';
import { Invitation, type InvitationStatus } from '../domain/invitation.entity';
import { Membership, type MembershipStatus } from '../domain/membership.entity';
import { isPermission } from '../domain/permissions';
import { Role } from '../domain/role.entity';
import { Slug } from '../domain/slug.vo';
import { Tenant, type TenantStatus } from '../domain/tenant.entity';

export const TenantMapper = {
  toDomain(row: TenantModel): Tenant {
    return Tenant.restore(row.id, {
      name: row.name,
      slug: Slug.restore(row.slug),
      status: row.status as TenantStatus,
      createdAt: row.createdAt,
    });
  },

  toPersistence(tenant: Tenant): TenantModel {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug.value,
      status: tenant.status,
      createdAt: tenant.createdAt,
    };
  },
};

export const RoleMapper = {
  toDomain(row: RoleModel): Role {
    return Role.restore(row.id, {
      tenantId: row.tenantId,
      key: row.key as SystemRoleKey | null,
      name: row.name,
      // Permissões removidas do catálogo são descartadas na leitura.
      permissions: row.permissions.filter(isPermission),
      isSystem: row.isSystem,
      createdAt: row.createdAt,
    });
  },

  toPersistence(role: Role): RoleModel {
    return {
      id: role.id,
      tenantId: role.tenantId,
      key: role.key,
      name: role.name,
      permissions: [...role.permissions],
      isSystem: role.isSystem,
      createdAt: role.createdAt,
    };
  },
};

export const MembershipMapper = {
  toDomain(row: MembershipModel): Membership {
    return Membership.restore(row.id, {
      tenantId: row.tenantId,
      userId: row.userId,
      roleId: row.roleId,
      status: row.status as MembershipStatus,
      createdAt: row.createdAt,
    });
  },

  toPersistence(membership: Membership): MembershipModel {
    return {
      id: membership.id,
      tenantId: membership.tenantId,
      userId: membership.userId,
      roleId: membership.roleId,
      status: membership.status,
      createdAt: membership.createdAt,
    };
  },
};

export const InvitationMapper = {
  toDomain(row: InvitationModel): Invitation {
    return Invitation.restore(row.id, {
      tenantId: row.tenantId,
      email: row.email,
      roleId: row.roleId,
      tokenHash: row.tokenHash,
      invitedByMembershipId: row.invitedByMembershipId,
      status: row.status as InvitationStatus,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      acceptedAt: row.acceptedAt,
    });
  },

  toPersistence(invitation: Invitation): InvitationModel {
    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      email: invitation.email,
      roleId: invitation.roleId,
      tokenHash: invitation.tokenHash,
      invitedByMembershipId: invitation.invitedByMembershipId,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
    };
  },
};
