import type { MemberView } from '../application/use-cases/members/list-members.use-case';
import type { Invitation } from '../domain/invitation.entity';
import type { Role } from '../domain/role.entity';

export const RolePresenter = {
  toHttp(role: Role) {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      permissions: role.permissions,
      isSystem: role.isSystem,
    };
  },

  toSummary(role: Role) {
    return { id: role.id, key: role.key, name: role.name };
  },
};

export const MemberPresenter = {
  toHttp(member: MemberView) {
    return {
      id: member.membershipId,
      user: member.user,
      role: RolePresenter.toSummary(member.role),
      status: member.status,
      joinedAt: member.joinedAt.toISOString(),
    };
  },
};

/** O token nunca aparece aqui — só no `inviteUrl` devolvido na criação. */
export const InvitationPresenter = {
  toHttp(invitation: Invitation) {
    return {
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.roleId,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  },
};
