import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { PARENT_ACCESS_PERMISSIONS } from '../../../domain/default-roles';
import { AccountAccessDeniedError } from '../../../domain/errors/account-access-denied.error';
import type { Membership } from '../../../domain/membership.entity';
import type { Tenant } from '../../../domain/tenant.entity';
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
 *
 * Vínculo DELEGADO (quem entrou vindo de uma conta acima): só vale enquanto o
 * vínculo de origem valer — ativo, da mesma pessoa, numa conta ACIMA desta,
 * não suspensa e com `accounts:children`. As permissões são as de
 * `PARENT_ACCESS_PERMISSIONS`. Com o cache de 60 s, tirar o acesso lá em
 * cima derruba o de cá em até um minuto.
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

    const delegatedFromTenantId = membership.isDelegated
      ? await this.delegationSource(membership, tenant)
      : null;

    const access: AccountAccess = {
      userId: membership.userId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: { id: role.id, key: role.key, name: role.name },
      permissions: membership.isDelegated ? [...PARENT_ACCESS_PERMISSIONS] : [...role.permissions],
      delegatedFromTenantId,
    };
    await this.cache.set(access);
    return access;
  }

  /** A conta de onde o acesso delegado vem — se ele ainda vale (senão, 401). */
  private async delegationSource(membership: Membership, tenant: Tenant): Promise<string> {
    const source = await this.memberships.findById(membership.delegatedFromMembershipId!);
    if (!source?.isActive || source.isDelegated || source.userId !== membership.userId) {
      throw new AccountAccessDeniedError();
    }
    if (!tenant.isBelow(source.tenantId)) throw new AccountAccessDeniedError();
    const [sourceTenant, sourceRole] = await Promise.all([
      this.tenants.findById(source.tenantId),
      this.roles.findById(source.roleId),
    ]);
    if (!sourceTenant?.allowsAccess || !sourceRole?.permissions.includes('accounts:children')) {
      throw new AccountAccessDeniedError();
    }
    return sourceTenant.id;
  }
}
