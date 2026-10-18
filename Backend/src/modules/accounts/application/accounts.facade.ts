import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor-context';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { Permission } from '../domain/permissions';
import { CurrentAccess } from './current-access';
import { MEMBERSHIP_REPOSITORY, type MembershipRepository } from './ports/membership.repository';
import { TENANT_REPOSITORY, type TenantRepository } from './ports/tenant.repository';
import { INVITATION_REPOSITORY, type InvitationRepository } from './ports/invitation.repository';
import { TenantEntitlements, type AccountPlan } from './tenant-entitlements';
import { ResolveAccessUseCase } from './use-cases/resolve-access/resolve-access.use-case';

/** O membro da requisição atual, como outros módulos o enxergam. */
export interface MemberAccess {
  membershipId: string;
  permissions: Permission[];
}

/** A conta da operação atual, como outros módulos a enxergam. */
export interface AccountSummary {
  id: string;
  name: string;
  slug: string;
  /** A conta da plataforma (raiz da hierarquia, ADR 0009). */
  isRoot: boolean;
}

/**
 * API síncrona do módulo para outros módulos (ex.: conversations aplicando
 * o escopo `:own`/`:all` das permissões). Exportada pelo `index.ts`.
 */
@Injectable()
export class AccountsFacade {
  constructor(
    private readonly access: CurrentAccess,
    private readonly resolveAccess: ResolveAccessUseCase,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    private readonly entitlements: TenantEntitlements,
  ) {}

  /** O plano da conta atual (ADR 0015). */
  currentPlan(): Promise<AccountPlan> {
    return this.entitlements.of(this.tenant.tenantId);
  }

  /** O que a conta atual usa do que é do accounts: membros (com convites pendentes) e contas filhas. */
  async planUsage(): Promise<{ members: number; childAccounts: number }> {
    const id = this.tenant.tenantId;
    const [active, pending, children] = await Promise.all([
      this.memberships.countActiveMembers(id),
      this.invitations.countPending(id),
      this.tenants.countChildren(id),
    ]);
    return { members: active + pending, childAccounts: children };
  }

  /**
   * O ator da requisição entrou nesta conta vindo de uma conta acima (acesso
   * delegado, ADR 0009)? Para o que só quem gerencia a conta pode fazer.
   */
  async actingFromParentAccount(): Promise<boolean> {
    return !!(await this.access.get()).delegatedFromTenantId;
  }

  /** A conta do tenant atual (ex.: nome e endereço sugeridos para o site). */
  async currentAccount(): Promise<AccountSummary> {
    const tenant = await this.tenants.findById(this.tenant.tenantId);
    if (!tenant) throw new Error(`Tenant ${this.tenant.tenantId} not found`);
    return { id: tenant.id, name: tenant.name, slug: tenant.slug.value, isRoot: tenant.isRoot };
  }

  /** Só em requisições autenticadas (usa o cache de acesso do AccessGuard). */
  async currentMember(): Promise<MemberAccess> {
    const { membershipId, permissions } = await this.access.get();
    return { membershipId, permissions };
  }

  /**
   * Acesso de um ator fora de uma requisição HTTP (ex.: conexão WebSocket).
   * Mesmas regras do AccessGuard: vínculo ativo, do mesmo usuário e tenant,
   * conta não suspensa — senão lança `AccountAccessDeniedError` (401).
   */
  async accessOf(actor: Actor): Promise<MemberAccess> {
    const { membershipId, permissions } = await this.resolveAccess.execute(actor);
    return { membershipId, permissions };
  }

  /** Dos ids informados, os que são vínculos ATIVOS no tenant atual. */
  async activeMemberIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    const members = await this.memberships.listByTenant(this.tenant.tenantId);
    return members.filter((m) => m.isActive && wanted.has(m.id)).map((m) => m.id);
  }
}
