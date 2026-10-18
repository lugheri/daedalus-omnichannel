import type { Actor } from '../../../../../shared/application/actor-context';
import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../../shared/testing/fakes';
import {
  DEFAULT_ROLES,
  PARENT_ACCESS_PERMISSIONS,
  type SystemRoleKey,
} from '../../../domain/default-roles';
import { AccountAccessDeniedError } from '../../../domain/errors/account-access-denied.error';
import { AccountNotAccessibleError } from '../../../domain/errors/account-not-accessible.error';
import { ChildAccountNotFoundError } from '../../../domain/errors/child-account-not-found.error';
import { TenantCreatedEvent } from '../../../domain/events/tenant-created.event';
import { Membership } from '../../../domain/membership.entity';
import { Role } from '../../../domain/role.entity';
import { Slug } from '../../../domain/slug.vo';
import { Tenant } from '../../../domain/tenant.entity';
import {
  FakeIdentityGateway,
  InMemoryAccessCache,
  InMemoryInvitationRepository,
  InMemoryMembershipRepository,
  InMemoryParentAccessRepository,
  InMemoryPlanRepository,
  InMemoryRoleRepository,
  InMemoryTenantRepository,
  SequentialInvitationTokenGenerator,
} from '../../../testing/fakes';
import { ListMyAccountsUseCase, SwitchAccountUseCase } from '../my-accounts/my-accounts.use-cases';
import { TenantEntitlements } from '../../tenant-entitlements';
import { ResolveAccessUseCase } from '../resolve-access/resolve-access.use-case';
import {
  CreateChildAccountUseCase,
  DesignateRootAccountUseCase,
  ListChildAccountsUseCase,
  ListParentAccessesUseCase,
  SetChildAccountStatusUseCase,
} from './child-accounts.use-cases';

/**
 * Árvore usada nos testes:
 *
 *   Daedalus (raiz) ── Revenda ── Cliente
 *                  └─ Outra
 */
describe('Account hierarchy', () => {
  let tenants: InMemoryTenantRepository;
  let roles: InMemoryRoleRepository;
  let memberships: InMemoryMembershipRepository;
  let invitations: InMemoryInvitationRepository;
  let accessLog: InMemoryParentAccessRepository;
  let identity: FakeIdentityGateway;
  let events: RecordingEventBus;
  const ids = new SequentialIdGenerator();
  const uow = new ImmediateUnitOfWork();
  let plans: InMemoryPlanRepository;
  const entitlements = () => new TenantEntitlements(new FakeTenantContext(), tenants, plans);

  let root: Tenant;
  let partner: Tenant;
  let client: Tenant;
  let other: Tenant;

  async function account(
    name: string,
    parent: Tenant | null,
    allowsChildren = false,
  ): Promise<Tenant> {
    const tenant = Tenant.create(`t-${name}`, {
      name,
      slug: Slug.fromName(name),
      parent,
      allowsChildren,
    });
    tenant.pullEvents();
    await tenants.save(tenant);
    await roles.saveMany(
      DEFAULT_ROLES.map((t) => Role.fromTemplate(`role-${name}-${t.key}`, tenant.id, t)),
    );
    return tenant;
  }

  async function member(
    userId: string,
    tenant: Tenant,
    key: SystemRoleKey,
    opts: { disabled?: boolean } = {},
  ): Promise<Membership> {
    const name = tenant.name;
    const m = Membership.createActive(`m-${userId}-${name}`, {
      tenantId: tenant.id,
      userId,
      roleId: `role-${name}-${key}`,
    });
    if (opts.disabled) m.disable();
    await memberships.save(m);
    return m;
  }

  const actorOf = (m: Membership): Actor => ({
    userId: m.userId,
    tenantId: m.tenantId,
    membershipId: m.id,
    sessionId: `s-${m.id}`,
  });

  const switcher = () =>
    new SwitchAccountUseCase(identity, memberships, tenants, roles, accessLog, ids, uow);
  const resolve = (actor: Actor) =>
    new ResolveAccessUseCase(memberships, roles, tenants, new InMemoryAccessCache()).execute(actor);
  /** Entra e devolve o ator da sessão nova (como o front faria com o token novo). */
  async function enter(from: Membership, tenantId: string): Promise<Actor> {
    await switcher().execute(actorOf(from), tenantId);
    const session = identity.sessions.at(-1)!;
    return { ...session, sessionId: 'new' };
  }

  beforeEach(async () => {
    tenants = new InMemoryTenantRepository();
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository();
    invitations = new InMemoryInvitationRepository();
    accessLog = new InMemoryParentAccessRepository();
    identity = new FakeIdentityGateway();
    events = new RecordingEventBus();
    plans = new InMemoryPlanRepository(tenants);

    root = await account('Daedalus', null);
    root.markRoot();
    await tenants.save(root);
    partner = await account('Revenda', root, true);
    client = await account('Cliente', partner);
    other = await account('Outra', root);
  });

  describe('the tree', () => {
    it('children know their parent and all ancestors', () => {
      expect(client.parentId).toBe(partner.id);
      expect(client.ancestors).toEqual([root.id, partner.id]);
      expect(client.isBelow(root.id)).toBe(true);
      expect(client.isBelow(other.id)).toBe(false);
    });

    it('lists the whole subtree, with the parent name and depth', async () => {
      const ana = await member('ana', root, 'owner');
      const all = await new ListChildAccountsUseCase(tenants, plans).execute(actorOf(ana));
      expect(all.map((c) => [c.tenant.name, c.parentName, c.depth])).toEqual([
        ['Cliente', 'Revenda', 2],
        ['Outra', 'Daedalus', 1],
        ['Revenda', 'Daedalus', 1],
      ]);

      const rafa = await member('rafa', partner, 'admin');
      const mine = await new ListChildAccountsUseCase(tenants, plans).execute(actorOf(rafa));
      expect(mine.map((c) => [c.tenant.name, c.depth])).toEqual([['Cliente', 1]]);
    });

    it('creates a child below the current account and invites its owner', async () => {
      const rafa = await member('rafa', partner, 'admin');
      const { tenant, inviteUrl } = await new CreateChildAccountUseCase(
        tenants,
        roles,
        invitations,
        new SequentialInvitationTokenGenerator(),
        { appUrl: 'https://app.test' },
        ids,
        events,
        uow,
        plans,
        entitlements(),
      ).execute(actorOf(rafa), { accountName: 'Padaria Nova', ownerEmail: 'Dono@Padaria.com' });

      expect(tenant.ancestors).toEqual([root.id, partner.id]);
      expect(inviteUrl).toMatch(/^https:\/\/app\.test\/invite\/invite-token-/);
      const [invite] = await invitations.listPending(tenant.id);
      const ownerRole = await roles.findByKey(tenant.id, 'owner');
      expect(invite).toMatchObject({ email: 'dono@padaria.com', roleId: ownerRole!.id });
      // Conta nova: os módulos reagem (funil padrão, etc.).
      expect(events.published).toEqual([expect.any(TenantCreatedEvent)]);
    });

    it('only a reseller (or the root) creates children; the account above decides who is a reseller', async () => {
      const create = (from: Membership) =>
        new CreateChildAccountUseCase(
          tenants,
          roles,
          invitations,
          new SequentialInvitationTokenGenerator(),
          { appUrl: 'https://app.test' },
          ids,
          events,
          uow,
          plans,
          entitlements(),
        ).execute(actorOf(from), { accountName: 'Sub cliente', ownerEmail: 's@x.com' });
      const cli = await member('cli', client, 'owner');
      await expect(create(cli)).rejects.toMatchObject({ code: 'CHILD_ACCOUNTS_NOT_ALLOWED' });

      const rafa = await member('rafa', partner, 'admin');
      const updated = await new SetChildAccountStatusUseCase(tenants).execute(
        actorOf(rafa),
        client.id,
        { allowsChildren: true },
      );
      expect(updated.canCreateChildren).toBe(true);
      await expect(create(cli)).resolves.toBeDefined();

      const ana = await member('ana', root, 'owner');
      await expect(create(ana)).resolves.toBeDefined(); // a raiz sempre pode
    });

    it('suspends and reactivates only accounts below', async () => {
      const rafa = await member('rafa', partner, 'admin');
      const status = new SetChildAccountStatusUseCase(tenants);
      expect(
        (await status.execute(actorOf(rafa), client.id, { status: 'suspended' })).allowsAccess,
      ).toBe(false);
      expect((await status.execute(actorOf(rafa), client.id, { status: 'active' })).status).toBe(
        'active',
      );
      await expect(
        status.execute(actorOf(rafa), other.id, { status: 'suspended' }),
      ).rejects.toThrow(ChildAccountNotFoundError);
      await expect(
        status.execute(actorOf(rafa), partner.id, { status: 'suspended' }),
      ).rejects.toThrow(ChildAccountNotFoundError);
    });
  });

  describe('entering an account below', () => {
    it('creates a delegated membership with Admin-like access, and logs it', async () => {
      const rafa = await member('rafa', partner, 'admin');
      identity.users.push({ id: 'rafa', name: 'Rafa', email: 'r@x.com', password: 'x' });

      const actor = await enter(rafa, client.id);
      const delegated = await memberships.findById(actor.membershipId);
      expect(delegated).toMatchObject({
        tenantId: client.id,
        isDelegated: true,
        delegatedFromMembershipId: rafa.id,
      });
      expect(identity.revokedSessions).toEqual([`s-${rafa.id}`]);

      const access = await resolve(actor);
      expect(access.role.key).toBe('parent_access');
      expect(access.permissions).toEqual([...PARENT_ACCESS_PERMISSIONS]);
      expect(access.permissions).not.toContain('account:manage');
      expect(access.delegatedFromTenantId).toBe(partner.id);

      // A conta acessada vê quem entrou e de onde.
      const cli = await member('cli', client, 'owner');
      const log = await new ListParentAccessesUseCase(accessLog, tenants, identity).execute(
        actorOf(cli),
      );
      expect(log.map((e) => [e.userName, e.fromAccountName])).toEqual([['Rafa', 'Revenda']]);
      expect(log[0].createdAt).toBeInstanceOf(Date);
    });

    it('entering again reuses the delegated membership; it never shows as an own account', async () => {
      const rafa = await member('rafa', partner, 'admin');
      const first = await enter(rafa, client.id);
      const second = await enter(rafa, client.id);
      expect(second.membershipId).toBe(first.membershipId);
      expect(accessLog.entries).toHaveLength(2);

      const own = await new ListMyAccountsUseCase(memberships, tenants).execute(actorOf(rafa));
      expect(own.map((t) => t.name)).toEqual(['Revenda']);
    });

    it('a grandparent account enters a grandchild directly', async () => {
      const ana = await member('ana', root, 'owner');
      const actor = await enter(ana, client.id);
      expect((await resolve(actor)).delegatedFromTenantId).toBe(root.id);
    });

    it('refuses: no accounts:children, not below, suspended, disabled source', async () => {
      const bia = await member('bia', partner, 'agent');
      await expect(enter(bia, client.id)).rejects.toThrow(AccountNotAccessibleError);

      const rafa = await member('rafa', partner, 'admin');
      await expect(enter(rafa, other.id)).rejects.toThrow(AccountNotAccessibleError);
      await expect(enter(rafa, root.id)).rejects.toThrow(AccountNotAccessibleError);

      client.suspend();
      await tenants.save(client);
      await expect(enter(rafa, client.id)).rejects.toThrow(AccountNotAccessibleError);

      const off = await member('off', partner, 'admin', { disabled: true });
      client.reactivate();
      await tenants.save(client);
      await expect(enter(off, client.id)).rejects.toThrow(AccountNotAccessibleError);
    });

    it('the delegated access falls as soon as the source no longer qualifies', async () => {
      const rafa = await member('rafa', partner, 'admin');
      const actor = await enter(rafa, client.id);
      await expect(resolve(actor)).resolves.toBeDefined();

      // Perdeu a permissão lá em cima (cargo trocado para Agent).
      rafa.changeRole('role-Revenda-agent');
      await memberships.save(rafa);
      await expect(resolve(actor)).rejects.toThrow(AccountAccessDeniedError);

      // Voltou a ser Admin, mas foi desativado.
      rafa.changeRole('role-Revenda-admin');
      rafa.disable();
      await memberships.save(rafa);
      await expect(resolve(actor)).rejects.toThrow(AccountAccessDeniedError);

      // Conta-mãe suspensa também derruba.
      rafa.enable();
      await memberships.save(rafa);
      partner.suspend();
      await tenants.save(partner);
      await expect(resolve(actor)).rejects.toThrow(AccountAccessDeniedError);
    });

    it('a delegated membership is not a source for going further down', async () => {
      // A Ana (raiz) entra na Revenda por delegação; de lá, entrar no Cliente
      // usa o vínculo PRÓPRIO dela na raiz, não o delegado.
      const ana = await member('ana', root, 'owner');
      const inPartner = await enter(ana, partner.id);
      const inClient = await enter(
        (await memberships.findById(inPartner.membershipId))!,
        client.id,
      );
      const delegated = await memberships.findById(inClient.membershipId);
      expect(delegated?.delegatedFromMembershipId).toBe(ana.id);
    });
  });

  describe('platform root', () => {
    it('designates the root once, adopting every account without a parent (and their subtrees)', async () => {
      const t2 = new InMemoryTenantRepository();
      const solo = Tenant.create('t-solo', { name: 'Solo', slug: Slug.fromName('solo') });
      const plat = Tenant.create('t-plat', { name: 'Plataforma', slug: Slug.fromName('plat') });
      const kid = Tenant.create('t-kid', {
        name: 'Filha da Solo',
        slug: Slug.fromName('kid'),
        parent: solo,
      });
      for (const t of [solo, plat, kid]) await t2.save(t);
      const designate = new DesignateRootAccountUseCase(t2, uow);

      const { adopted } = await designate.execute('plat');
      expect(adopted).toBe(1);
      expect((await t2.findById('t-solo'))?.ancestors).toEqual(['t-plat']);
      expect((await t2.findById('t-solo'))?.parentId).toBe('t-plat');
      expect((await t2.findById('t-kid'))?.ancestors).toEqual(['t-plat', 't-solo']);
      expect((await t2.findRoot())?.id).toBe('t-plat');

      await expect(designate.execute('solo')).rejects.toMatchObject({
        code: 'ROOT_ALREADY_DEFINED',
      });
      await expect(designate.execute('nope')).rejects.toMatchObject({ code: 'ROOT_NOT_FOUND' });
    });
  });
});
