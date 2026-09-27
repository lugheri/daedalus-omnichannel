import { LastOwnerError } from '../../../domain/errors/last-owner.error';
import { MemberNotFoundError } from '../../../domain/errors/member-not-found.error';
import { RoleNotFoundError } from '../../../domain/errors/role-not-found.error';
import type { Membership } from '../../../domain/membership.entity';
import type { Role } from '../../../domain/role.entity';
import type { MembershipRepository } from '../../ports/membership.repository';
import type { RoleRepository } from '../../ports/role.repository';

/** Carrega o vínculo e o cargo atual dele, ambos do tenant informado (senão 404). */
export async function loadMember(
  deps: { memberships: MembershipRepository; roles: RoleRepository },
  tenantId: string,
  membershipId: string,
): Promise<{ membership: Membership; role: Role }> {
  const membership = await deps.memberships.findInTenant(tenantId, membershipId);
  if (!membership) throw new MemberNotFoundError();

  const role = await deps.roles.findInTenant(tenantId, membership.roleId);
  if (!role) throw new RoleNotFoundError();
  return { membership, role };
}

/**
 * A conta nunca fica sem um Owner ativo: tirar o cargo de Owner ou
 * desativar um Owner só é permitido se houver outro.
 */
export async function ensureAnotherOwnerRemains(
  memberships: MembershipRepository,
  membership: Membership,
  currentRole: Role,
): Promise<void> {
  if (!currentRole.isOwner || !membership.isActive) return;

  const activeOwners = await memberships.countActiveWithRole(membership.tenantId, currentRole.id);
  if (activeOwners <= 1) throw new LastOwnerError();
}
