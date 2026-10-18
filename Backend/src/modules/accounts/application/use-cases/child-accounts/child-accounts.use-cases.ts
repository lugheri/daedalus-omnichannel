import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { DEFAULT_ROLES } from '../../../domain/default-roles';
import { ChildAccountNotFoundError } from '../../../domain/errors/child-account-not-found.error';
import { ChildrenNotAllowedError } from '../../../domain/errors/children-not-allowed.error';
import { InvalidRootError } from '../../../domain/errors/invalid-root.error';
import { Invitation } from '../../../domain/invitation.entity';
import { Role } from '../../../domain/role.entity';
import { Tenant } from '../../../domain/tenant.entity';
import { ACCOUNTS_SETTINGS, type AccountsSettings } from '../../ports/accounts-settings';
import { IDENTITY_GATEWAY, type IdentityGateway } from '../../ports/identity.gateway';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository';
import {
  INVITATION_TOKEN_GENERATOR,
  type InvitationTokenGenerator,
} from '../../ports/invitation-token-generator';
import {
  PARENT_ACCESS_REPOSITORY,
  type ParentAccessRepository,
} from '../../ports/parent-access.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';
import { PLAN_REPOSITORY, type PlanRepository } from '../../ports/plan.repository';
import { TenantEntitlements } from '../../tenant-entitlements';
import { uniqueSlugFor } from '../../unique-slug';
import { assertAssignable, loadPlan } from '../plans/plans.use-cases';

/** Conta abaixo da atual, com o nome da mãe e a profundidade (1 = filha direta). */
export interface ChildAccountView {
  tenant: Tenant;
  parentName: string | null;
  depth: number;
  /** Nome do plano escolhido (null = o padrão). */
  planName: string | null;
}

/**
 * Contas abaixo da atual (filhas, netas...) — a árvore inteira (ADR 0009).
 * Exige `accounts:children` (na rota).
 */
@Injectable()
export class ListChildAccountsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
  ) {}

  async execute(actor: Actor): Promise<ChildAccountView[]> {
    const current = await this.tenants.findById(actor.tenantId);
    if (!current) return [];
    const [descendants, plans] = await Promise.all([
      this.tenants.listDescendants(current.id),
      this.plans.list(),
    ]);
    const names = new Map([current, ...descendants].map((t) => [t.id, t.name]));
    const planNames = new Map(plans.map((p) => [p.id, p.name]));
    return descendants.map((tenant) => ({
      tenant,
      parentName: tenant.parentId ? (names.get(tenant.parentId) ?? null) : null,
      depth: tenant.ancestors.length - current.ancestors.length,
      planName: tenant.planId ? (planNames.get(tenant.planId) ?? null) : null,
    }));
  }
}

/**
 * Cria uma conta filha da atual (o cliente de um revendedor, por exemplo),
 * com os cargos padrão, e convida o dono dela por e-mail como Owner — o
 * link vai para quem criou repassar (como no convite de membro). Só conta
 * revendedora (ou a raiz) cria; `allowsChildren` faz da nova uma revendedora.
 */
@Injectable()
export class CreateChildAccountUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_TOKEN_GENERATOR) private readonly tokens: InvitationTokenGenerator,
    @Inject(ACCOUNTS_SETTINGS) private readonly settings: AccountsSettings,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    private readonly entitlements: TenantEntitlements,
  ) {}

  async execute(
    actor: Actor,
    input: {
      accountName: string;
      ownerEmail: string;
      allowsChildren?: boolean;
      /** Plano da conta nova (null/ausente = o padrão). */
      planId?: string | null;
    },
  ): Promise<{ tenant: Tenant; inviteUrl: string }> {
    const { token, hash } = this.tokens.generate();
    const tenant = await this.unitOfWork.run(async () => {
      const parent = await this.tenants.findById(actor.tenantId);
      if (!parent) throw new ChildAccountNotFoundError();
      if (!parent.canCreateChildren) throw new ChildrenNotAllowedError();
      // Plano do revendedor: quantas contas diretamente abaixo dele.
      await this.entitlements.roomFor(
        parent.id,
        'childAccounts',
        await this.tenants.countChildren(parent.id),
      );
      const plan = input.planId ? await loadPlan(this.plans, input.planId) : null;
      if (plan) assertAssignable(parent, plan, null);
      const tenant = Tenant.create(this.ids.generate(), {
        name: input.accountName,
        slug: await uniqueSlugFor(this.tenants, this.ids, input.accountName),
        parent,
        allowsChildren: input.allowsChildren ?? false,
      });
      if (plan) tenant.setPlan(plan.id);
      const roles = DEFAULT_ROLES.map((template) =>
        Role.fromTemplate(this.ids.generate(), tenant.id, template),
      );
      const invitation = Invitation.create(this.ids.generate(), {
        tenantId: tenant.id,
        email: input.ownerEmail,
        roleId: roles.find((role) => role.key === 'owner')!.id,
        tokenHash: hash,
        // Quem convidou é de outra conta (a mãe): fica o vínculo dela.
        invitedBy: actor.membershipId,
      });

      await this.tenants.save(tenant);
      await this.roles.saveMany(roles);
      await this.invitations.save(invitation);
      await this.events.publish(tenant.pullEvents());
      return tenant;
    });
    return { tenant, inviteUrl: `${this.settings.appUrl}/invite/${token}` };
  }
}

/**
 * Suspende (ninguém entra, nem quem vem de cima) ou reativa uma conta abaixo
 * da atual. Os acessos em andamento caem em até um minuto (cache de acesso).
 */
@Injectable()
export class SetChildAccountStatusUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository) {}

  async execute(
    actor: Actor,
    childId: string,
    change: { status?: 'suspended' | 'active'; allowsChildren?: boolean },
  ): Promise<Tenant> {
    const child = await this.tenants.findById(childId);
    if (!child?.isBelow(actor.tenantId)) throw new ChildAccountNotFoundError();
    if (change.status === 'suspended') child.suspend();
    if (change.status === 'active') child.reactivate();
    // Revendedor: passa a poder (ou deixa de poder) criar contas abaixo.
    if (change.allowsChildren !== undefined) child.setAllowsChildren(change.allowsChildren);
    await this.tenants.save(child);
    return child;
  }
}

export interface ParentAccessView {
  createdAt: Date;
  userName: string;
  fromAccountName: string;
}

/**
 * Quem de uma conta acima entrou nesta, e quando (a conta acessada vê —
 * transparência sobre quem mexe nos dados dela). Exige `members:manage`.
 */
@Injectable()
export class ListParentAccessesUseCase {
  constructor(
    @Inject(PARENT_ACCESS_REPOSITORY) private readonly log: ParentAccessRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
  ) {}

  async execute(actor: Actor): Promise<ParentAccessView[]> {
    const entries = await this.log.listByTenant(actor.tenantId, 100);
    const [users, tenants] = await Promise.all([
      this.identity.findUsers([...new Set(entries.map((e) => e.userId))]),
      this.tenants.findManyByIds([...new Set(entries.map((e) => e.fromTenantId))]),
    ]);
    const userName = new Map(users.map((u) => [u.id, u.name]));
    const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
    return entries.map((entry) => ({
      createdAt: entry.createdAt,
      userName: userName.get(entry.userId) ?? 'Pessoa removida',
      fromAccountName: tenantName.get(entry.fromTenantId) ?? 'Conta removida',
    }));
  }
}

/**
 * Define a conta da plataforma (a raiz da árvore) — feito uma vez, pela linha
 * de comando. Toda conta que ainda não tem mãe passa a ficar debaixo dela.
 */
@Injectable()
export class DesignateRootAccountUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(slug: string): Promise<{ root: Tenant; adopted: number }> {
    return this.unitOfWork.run(async () => {
      const tenant = await this.tenants.findBySlug(slug);
      if (!tenant) throw new InvalidRootError('ROOT_NOT_FOUND');
      const current = await this.tenants.findRoot();
      if (current && current.id !== tenant.id) throw new InvalidRootError('ROOT_ALREADY_DEFINED');
      if (tenant.parentId) throw new InvalidRootError('ROOT_HAS_PARENT');

      tenant.markRoot();
      await this.tenants.save(tenant);
      const adopted = await this.tenants.adoptOrphans(tenant);
      return { root: tenant, adopted };
    });
  }
}
