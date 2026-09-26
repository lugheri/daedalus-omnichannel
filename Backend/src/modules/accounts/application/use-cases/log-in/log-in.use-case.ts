import { Inject, Injectable } from '@nestjs/common';
import { AccountAccessDeniedError } from '../../../domain/errors/account-access-denied.error';
import type { Membership } from '../../../domain/membership.entity';
import type { Tenant } from '../../../domain/tenant.entity';
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

export interface LogInInput {
  email: string;
  password: string;
  /** Obrigatório quando a pessoa tem acesso a mais de uma conta. */
  tenantId?: string;
}

export type LogInResult =
  | { kind: 'authenticated'; tenant: Tenant; tokens: SessionTokens }
  | { kind: 'tenant-selection-required'; tenants: Tenant[] };

/**
 * Login em duas etapas só quando necessário: com uma conta, entra direto;
 * com várias e sem `tenantId`, devolve a lista para a pessoa escolher, e o
 * cliente repete o login informando a conta.
 */
@Injectable()
export class LogInUseCase {
  constructor(
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async execute(input: LogInInput): Promise<LogInResult> {
    const user = await this.identity.authenticate({
      email: input.email,
      password: input.password,
    });

    const accesses = await this.accessibleAccounts(user.id);
    if (accesses.length === 0) throw new AccountAccessDeniedError();

    const chosen = input.tenantId
      ? accesses.find(({ tenant }) => tenant.id === input.tenantId)
      : accesses.length === 1
        ? accesses[0]
        : undefined;

    if (!chosen && input.tenantId) throw new AccountAccessDeniedError();
    if (!chosen) {
      return { kind: 'tenant-selection-required', tenants: accesses.map(({ tenant }) => tenant) };
    }

    const tokens = await this.identity.startSession({
      userId: user.id,
      tenantId: chosen.tenant.id,
      membershipId: chosen.membership.id,
    });
    return { kind: 'authenticated', tenant: chosen.tenant, tokens };
  }

  /** Vínculos ativos em contas que não estão suspensas. */
  private async accessibleAccounts(
    userId: string,
  ): Promise<{ membership: Membership; tenant: Tenant }[]> {
    const memberships = await this.memberships.findActiveByUserId(userId);
    const tenants = await this.tenants.findManyByIds(memberships.map((m) => m.tenantId));

    return memberships.flatMap((membership) => {
      const tenant = tenants.find((t) => t.id === membership.tenantId);
      return tenant?.allowsAccess ? [{ membership, tenant }] : [];
    });
  }
}
