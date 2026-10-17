import type { Membership } from '../domain/membership.entity';
import type { Tenant } from '../domain/tenant.entity';
import type { MembershipRepository } from './ports/membership.repository';
import type { TenantRepository } from './ports/tenant.repository';

export interface AccessibleAccount {
  membership: Membership;
  tenant: Tenant;
}

/**
 * As contas em que a pessoa pode entrar PELO PRÓPRIO VÍNCULO: ativo, não
 * delegado, em conta que não está suspensa. Regra única para o login, a lista
 * de contas e a troca de conta (entrar numa conta abaixo é outra regra: ver
 * `SwitchAccountUseCase`).
 */
export async function findAccessibleAccounts(
  memberships: MembershipRepository,
  tenants: TenantRepository,
  userId: string,
): Promise<AccessibleAccount[]> {
  const active = (await memberships.findActiveByUserId(userId)).filter((m) => !m.isDelegated);
  const found = await tenants.findManyByIds(active.map((m) => m.tenantId));

  return active.flatMap((membership) => {
    const tenant = found.find((t) => t.id === membership.tenantId);
    return tenant?.allowsAccess ? [{ membership, tenant }] : [];
  });
}
