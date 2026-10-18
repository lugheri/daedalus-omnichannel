import type { Actor } from '../../../../../shared/application/actor-context';
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  type PlanFeature,
  type PlanLimit,
} from '../../../../../shared/domain/plan-entitlement';
import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../../shared/testing/fakes';
import { DEFAULT_ROLES } from '../../../domain/default-roles';
import type { PlanDetails } from '../../../domain/plan.entity';
import { Role } from '../../../domain/role.entity';
import { Slug } from '../../../domain/slug.vo';
import { Tenant } from '../../../domain/tenant.entity';
import {
  InMemoryInvitationRepository,
  InMemoryPlanRepository,
  InMemoryRoleRepository,
  InMemoryTenantRepository,
  SequentialInvitationTokenGenerator,
} from '../../../testing/fakes';
import { accountScenario, roleId, TENANT_ID } from '../../../testing/scenario';
import { TenantEntitlements } from '../../tenant-entitlements';
import { CreateChildAccountUseCase } from '../child-accounts/child-accounts.use-cases';
import { InviteMemberUseCase } from '../invitations/invite-member.use-case';
import { SetMemberStatusUseCase } from '../members/set-member-status.use-case';
import {
  CreatePlanUseCase,
  DeletePlanUseCase,
  ListAssignablePlansUseCase,
  ListPlansUseCase,
  PlanKeeper,
  SetChildAccountPlanUseCase,
  SetDefaultPlanUseCase,
  UpdatePlanUseCase,
} from './plans.use-cases';

const details = (
  name: string,
  opts: {
    limits?: Partial<Record<PlanLimit, number | null>>;
    without?: PlanFeature[];
    resellable?: boolean;
  } = {},
): PlanDetails => ({
  name,
  description: null,
  limits: Object.fromEntries(PLAN_LIMITS.map((k) => [k, opts.limits?.[k] ?? null])) as Record<
    PlanLimit,
    number | null
  >,
  features: Object.fromEntries(
    PLAN_FEATURES.map((f) => [f, !(opts.without ?? []).includes(f)]),
  ) as Record<PlanFeature, boolean>,
  resellable: opts.resellable ?? false,
});

/**
 *   Daedalus (raiz) ── Revenda ── Cliente
 *                  └─ Outra
 */
describe('Plans', () => {
  let tenants: InMemoryTenantRepository;
  let plans: InMemoryPlanRepository;
  const ids = new SequentialIdGenerator();
  let root: Tenant;
  let partner: Tenant;
  let client: Tenant;
  let other: Tenant;

  const actor = (tenant: Tenant): Actor => ({
    userId: 'u',
    tenantId: tenant.id,
    membershipId: `m-${tenant.id}`,
    sessionId: 's',
  });
  const account = async (name: string, parent: Tenant | null, allowsChildren = false) => {
    const tenant = Tenant.create(`t-${name}`, {
      name,
      slug: Slug.fromName(name),
      parent,
      allowsChildren,
    });
    await tenants.save(tenant);
    return tenant;
  };
  const keeper = () => new PlanKeeper(tenants);
  const create = (d: PlanDetails) =>
    new CreatePlanUseCase(keeper(), plans, ids).execute(actor(root), d);
  const entitlements = () => new TenantEntitlements(new FakeTenantContext(), tenants, plans);
  const setPlan = (by: Tenant, child: Tenant, planId: string | null) =>
    new SetChildAccountPlanUseCase(plans, tenants).execute(actor(by), child.id, planId);

  beforeEach(async () => {
    tenants = new InMemoryTenantRepository();
    plans = new InMemoryPlanRepository(tenants);
    root = await account('Daedalus', null);
    root.markRoot();
    partner = await account('Revenda', root, true);
    client = await account('Cliente', partner);
    other = await account('Outra', root);
  });

  it('the catalog is kept only by the platform; limits are validated', async () => {
    await expect(
      new ListPlansUseCase(keeper(), plans).execute(actor(partner)),
    ).rejects.toMatchObject({ code: 'PLANS_ROOT_ONLY' });
    await expect(create(details('Ruim', { limits: { members: -1 } }))).rejects.toMatchObject({
      code: 'PLAN_INVALID_LIMIT',
    });
    await expect(create(details(' '))).rejects.toMatchObject({ code: 'PLAN_INVALID_NAME' });

    const basic = await create(details('Básico', { limits: { members: 3 } }));
    await new SetDefaultPlanUseCase(keeper(), plans, new ImmediateUnitOfWork()).execute(
      actor(root),
      basic.id,
    );
    const pro = await create(details('Pro'));
    await new SetDefaultPlanUseCase(keeper(), plans, new ImmediateUnitOfWork()).execute(
      actor(root),
      pro.id,
    );
    await setPlan(root, other, basic.id);
    const list = await new ListPlansUseCase(keeper(), plans).execute(actor(root));
    // O padrão conta também as contas sem plano escolhido (menos a "Outra" e a plataforma).
    expect(list.map((p) => [p.plan.name, p.plan.isDefault, p.accounts])).toEqual([
      ['Básico', false, 1],
      ['Pro', true, 2],
    ]);

    const remove = new DeletePlanUseCase(keeper(), plans);
    await expect(remove.execute(actor(root), pro.id)).rejects.toMatchObject({
      code: 'PLAN_IS_DEFAULT',
    });
    await expect(remove.execute(actor(root), basic.id)).rejects.toMatchObject({
      code: 'PLAN_IN_USE',
    });
    const update = new UpdatePlanUseCase(keeper(), plans);
    await expect(update.execute(actor(root), pro.id, { archived: true })).rejects.toMatchObject({
      code: 'PLAN_IS_DEFAULT',
    });
    expect((await update.execute(actor(root), basic.id, { archived: true })).archived).toBe(true);
  });

  it('the platform gives any plan; a reseller only the resellable ones, to its own subtree', async () => {
    const resold = await create(details('Revenda Básico', { resellable: true }));
    const premium = await create(details('Premium'));
    const assignable = new ListAssignablePlansUseCase(plans, tenants);
    expect((await assignable.execute(actor(root))).map((p) => p.name)).toEqual([
      'Premium',
      'Revenda Básico',
    ]);
    expect((await assignable.execute(actor(partner))).map((p) => p.name)).toEqual([
      'Revenda Básico',
    ]);
    expect(await assignable.execute(actor(client))).toEqual([]);

    await expect(setPlan(partner, client, premium.id)).rejects.toMatchObject({
      code: 'PLAN_NOT_ASSIGNABLE',
    });
    expect((await setPlan(partner, client, resold.id)).planId).toBe(resold.id);
    await expect(setPlan(partner, other, resold.id)).rejects.toMatchObject({
      code: 'CHILD_ACCOUNT_NOT_FOUND',
    });
    expect((await setPlan(root, client, premium.id)).planId).toBe(premium.id);

    // Arquivado sai da escolha, mas quem já está nele pode continuar.
    await new UpdatePlanUseCase(keeper(), plans).execute(actor(root), premium.id, {
      archived: true,
    });
    await expect(setPlan(root, other, premium.id)).rejects.toMatchObject({
      code: 'PLAN_NOT_ASSIGNABLE',
    });
    expect((await setPlan(root, client, premium.id)).planId).toBe(premium.id);
    expect((await setPlan(root, client, null)).planId).toBeNull();
  });

  it('entitlements: the chosen plan, else the default; the platform has no limits', async () => {
    const standard = await create(details('Padrão', { limits: { forms: 1 } }));
    await new SetDefaultPlanUseCase(keeper(), plans, new ImmediateUnitOfWork()).execute(
      actor(root),
      standard.id,
    );
    const lite = await create(
      details('Lite', { limits: { whatsappChannels: 1 }, without: ['campaigns'] }),
    );
    await setPlan(root, client, lite.id);
    const e = entitlements();

    expect((await e.of(client.id)).plan?.name).toBe('Lite');
    expect((await e.of(other.id)).plan?.name).toBe('Padrão');
    expect(await e.of(root.id)).toEqual({ plan: null, unlimited: true });

    await expect(e.roomFor(client.id, 'whatsappChannels', 0)).resolves.toBeUndefined();
    await expect(e.roomFor(client.id, 'whatsappChannels', 1)).rejects.toMatchObject({
      code: 'PLAN_LIMIT_WHATSAPP_CHANNELS',
      max: 1,
    });
    await expect(e.featureFor(client.id, 'campaigns')).rejects.toMatchObject({
      code: 'PLAN_FEATURE_CAMPAIGNS',
    });
    await expect(e.roomFor(other.id, 'forms', 1)).rejects.toMatchObject({
      code: 'PLAN_LIMIT_FORMS',
    });
    await expect(e.roomFor(root.id, 'forms', 999)).resolves.toBeUndefined();
    await expect(e.featureFor(root.id, 'campaigns')).resolves.toBeUndefined();
  });

  it('a reseller creates child accounts up to its plan limit, with a plan it may give', async () => {
    const roles = new InMemoryRoleRepository();
    await roles.saveMany(
      DEFAULT_ROLES.map((t) => Role.fromTemplate(`role-${t.key}`, partner.id, t)),
    );
    const resold = await create(details('Revenda', { resellable: true }));
    const premium = await create(details('Premium'));
    const reseller = await create(details('Plano do revendedor', { limits: { childAccounts: 2 } }));
    await setPlan(root, partner, reseller.id);
    const createChild = (planId: string | null) =>
      new CreateChildAccountUseCase(
        tenants,
        roles,
        new InMemoryInvitationRepository(),
        new SequentialInvitationTokenGenerator(),
        { appUrl: 'https://app.test' },
        ids,
        new RecordingEventBus(),
        new ImmediateUnitOfWork(),
        plans,
        entitlements(),
      ).execute(actor(partner), {
        accountName: `Nova ${ids.generate()}`,
        ownerEmail: 'a@b.com',
        planId,
      });

    await expect(createChild(premium.id)).rejects.toMatchObject({ code: 'PLAN_NOT_ASSIGNABLE' });
    const { tenant } = await createChild(resold.id);
    expect(tenant.planId).toBe(resold.id);
    // Já tem a "Cliente" e a nova: chegou a 2.
    await expect(createChild(null)).rejects.toMatchObject({ code: 'PLAN_LIMIT_CHILD_ACCOUNTS' });
  });

  it('members: active members plus pending invitations fill the plan', async () => {
    const s = await accountScenario();
    const small = await new CreatePlanUseCase(keeper(), s.plans, ids).execute(
      actor(root),
      details('Pequeno', { limits: { members: 3 } }),
    );
    // A conta do cenário vai para o plano (como faria a plataforma).
    const account = (await s.tenants.findById(TENANT_ID))!;
    account.setPlan(small.id);
    await s.tenants.save(account);
    await s.addMember('owner', 'owner');
    await s.addMember('ana', 'agent');
    await s.addMember('bia', 'agent', { disabled: true });
    await s.actAs('m-owner');
    const invite = new InviteMemberUseCase(
      s.currentAccess,
      s.roles,
      s.memberships,
      s.invitations,
      s.tokens,
      s.identity,
      s.settings,
      s.ids,
      s.unitOfWork,
      s.entitlements,
    );
    await invite.execute({ email: 'novo@loja.com', roleId: roleId('agent') });
    // 2 ativos + 1 convite = 3: o 4º não cabe; reenviar o mesmo convite cabe.
    await expect(
      invite.execute({ email: 'outro@loja.com', roleId: roleId('agent') }),
    ).rejects.toMatchObject({ code: 'PLAN_LIMIT_MEMBERS' });
    await expect(
      invite.execute({ email: 'novo@loja.com', roleId: roleId('agent') }),
    ).resolves.toBeDefined();
    const setStatus = new SetMemberStatusUseCase(
      s.currentAccess,
      s.memberships,
      s.roles,
      s.cache,
      s.identity,
      s.unitOfWork,
      s.invitations,
      s.entitlements,
    );
    await expect(setStatus.execute({ membershipId: 'm-bia', active: true })).rejects.toMatchObject({
      code: 'PLAN_LIMIT_MEMBERS',
    });
    // Desativar não esbarra no plano; abre lugar.
    await setStatus.execute({ membershipId: 'm-ana', active: false });
    await setStatus.execute({ membershipId: 'm-bia', active: true });
  });
});
