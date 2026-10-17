import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { PARENT_ACCESS_ROLE } from '../../../domain/default-roles';
import { AccountNotAccessibleError } from '../../../domain/errors/account-not-accessible.error';
import { Membership } from '../../../domain/membership.entity';
import { Role } from '../../../domain/role.entity';
import type { Tenant } from '../../../domain/tenant.entity';
import { findAccessibleAccounts } from '../../accessible-accounts';
import {
  IDENTITY_GATEWAY,
  type IdentityGateway,
  type SessionTokens,
} from '../../ports/identity.gateway';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import {
  PARENT_ACCESS_REPOSITORY,
  type ParentAccessRepository,
} from '../../ports/parent-access.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';

/** As contas em que a pessoa logada pode entrar (para o seletor de conta). */
@Injectable()
export class ListMyAccountsUseCase {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async execute(actor: Actor): Promise<Tenant[]> {
    const accounts = await findAccessibleAccounts(this.memberships, this.tenants, actor.userId);
    return accounts
      .map(({ tenant }) => tenant)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}

/**
 * Troca de conta sem pedir a senha de novo: um token vale para UMA conta
 * (ADR 0004), então abre uma sessão nova na conta escolhida e encerra a
 * atual — a da conta anterior não fica viva esquecida no navegador.
 *
 * Duas portas de entrada:
 * - o próprio vínculo da pessoa na conta (membro comum);
 * - **conta abaixo** de uma em que ela é membro (não delegado) com
 *   `accounts:children`: entra por um vínculo DELEGADO, com o cargo de sistema
 *   "Acesso da conta-mãe" (ADR 0009). A entrada fica registrada para a conta
 *   acessada ver. Conta suspensa: ninguém entra.
 */
@Injectable()
export class SwitchAccountUseCase {
  constructor(
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PARENT_ACCESS_REPOSITORY) private readonly accessLog: ParentAccessRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    actor: Actor,
    tenantId: string,
  ): Promise<{ tenant: Tenant; tokens: SessionTokens }> {
    const accounts = await findAccessibleAccounts(this.memberships, this.tenants, actor.userId);
    const own = accounts.find(({ tenant }) => tenant.id === tenantId);
    const entry = own ?? (await this.enterBelow(actor.userId, tenantId));

    const tokens = await this.identity.startSession({
      userId: actor.userId,
      tenantId: entry.tenant.id,
      membershipId: entry.membership.id,
    });
    await this.identity.revokeSession(actor.sessionId);
    return { tenant: entry.tenant, tokens };
  }

  /** Entrada vinda de cima: acha o vínculo de origem e prepara o delegado. */
  private async enterBelow(
    userId: string,
    tenantId: string,
  ): Promise<{ tenant: Tenant; membership: Membership }> {
    const tenant = await this.tenants.findById(tenantId);
    if (!tenant?.allowsAccess) throw new AccountNotAccessibleError();
    const source = await this.sourceAbove(tenant, userId);
    if (!source) throw new AccountNotAccessibleError();

    return this.unitOfWork.run(async () => {
      const role = await this.parentAccessRole(tenant.id);
      let membership = await this.memberships.findByUser(tenant.id, userId);
      if (membership) {
        // Já entrou antes (ou era membro e foi desativado): volta como acesso da conta-mãe.
        membership.redelegate(source.id, role.id);
      } else {
        membership = Membership.createDelegated(this.ids.generate(), {
          tenantId: tenant.id,
          userId,
          roleId: role.id,
          fromMembershipId: source.id,
        });
      }
      await this.memberships.save(membership);
      await this.accessLog.record({
        id: this.ids.generate(),
        tenantId: tenant.id,
        membershipId: membership.id,
        userId,
        fromTenantId: source.tenantId,
        createdAt: new Date(),
      });
      return { tenant, membership };
    });
  }

  /**
   * O vínculo da pessoa na conta acima mais próxima em que ela pode gerenciar
   * contas filhas (próprio, ativo, conta não suspensa, com `accounts:children`).
   */
  private async sourceAbove(tenant: Tenant, userId: string): Promise<Membership | null> {
    for (const ancestorId of [...tenant.ancestors].reverse()) {
      const membership = await this.memberships.findByUser(ancestorId, userId);
      if (!membership?.isActive || membership.isDelegated) continue;
      const [ancestor, role] = await Promise.all([
        this.tenants.findById(ancestorId),
        this.roles.findById(membership.roleId),
      ]);
      if (ancestor?.allowsAccess && role?.permissions.includes('accounts:children')) {
        return membership;
      }
    }
    return null;
  }

  /** O cargo de sistema dos acessos da conta-mãe (criado na primeira entrada). */
  private async parentAccessRole(tenantId: string): Promise<Role> {
    const existing = await this.roles.findByKey(tenantId, PARENT_ACCESS_ROLE.key);
    if (existing) return existing;
    const role = Role.fromTemplate(this.ids.generate(), tenantId, PARENT_ACCESS_ROLE);
    await this.roles.save(role);
    return role;
  }
}
