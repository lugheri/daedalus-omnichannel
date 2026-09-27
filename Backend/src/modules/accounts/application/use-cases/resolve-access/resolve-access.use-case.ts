import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { AccountAccessDeniedError } from '../../../domain/errors/account-access-denied.error';
import type { AccountAccess } from '../../account-access';
import { ACCESS_CACHE, type AccessCache } from '../../ports/access-cache';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';

/**
 * Confirma, a cada requisição, que o vínculo do token continua valendo e
 * devolve as permissões atuais do cargo (ADR 0004: revogar acesso tem efeito
 * imediato, por isso as permissões não vêm do token).
 *
 * Nega (401) se o vínculo não existe, foi desativado, não é deste usuário/
 * tenant, ou se a conta está suspensa.
 */
@Injectable()
export class ResolveAccessUseCase {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(ACCESS_CACHE) private readonly cache: AccessCache,
  ) {}

  async execute(actor: Actor): Promise<AccountAccess> {
    const access = (await this.cache.get(actor.membershipId)) ?? (await this.load(actor));

    // O vínculo precisa ser do mesmo usuário e tenant do token — um token
    // forjado com o mid de outra pessoa não passa daqui.
    if (access.userId !== actor.userId || access.tenantId !== actor.tenantId) {
      throw new AccountAccessDeniedError();
    }
    return access;
  }

  private async load(actor: Actor): Promise<AccountAccess> {
    const membership = await this.memberships.findById(actor.membershipId);
    if (!membership?.isActive) throw new AccountAccessDeniedError();

    const [tenant, role] = await Promise.all([
      this.tenants.findById(membership.tenantId),
      this.roles.findById(membership.roleId),
    ]);
    if (!tenant?.allowsAccess || !role) throw new AccountAccessDeniedError();

    const access: AccountAccess = {
      userId: membership.userId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: { id: role.id, key: role.key, name: role.name },
      permissions: [...role.permissions],
    };
    await this.cache.set(access);
    return access;
  }
}
