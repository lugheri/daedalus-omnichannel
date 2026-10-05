import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { AccountNotAccessibleError } from '../../../domain/errors/account-not-accessible.error';
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
 */
@Injectable()
export class SwitchAccountUseCase {
  constructor(
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async execute(
    actor: Actor,
    tenantId: string,
  ): Promise<{ tenant: Tenant; tokens: SessionTokens }> {
    const accounts = await findAccessibleAccounts(this.memberships, this.tenants, actor.userId);
    const chosen = accounts.find(({ tenant }) => tenant.id === tenantId);
    if (!chosen) throw new AccountNotAccessibleError();

    const tokens = await this.identity.startSession({
      userId: actor.userId,
      tenantId: chosen.tenant.id,
      membershipId: chosen.membership.id,
    });
    await this.identity.revokeSession(actor.sessionId);
    return { tenant: chosen.tenant, tokens };
  }
}
