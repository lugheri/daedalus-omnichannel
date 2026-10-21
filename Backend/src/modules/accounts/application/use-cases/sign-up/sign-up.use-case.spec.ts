import {
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../../shared/testing/fakes';
import { InvalidTenantNameError } from '../../../domain/errors/invalid-tenant-name.error';
import { TenantCreatedEvent } from '../../../domain/events/tenant-created.event';
import { SignUpClosedError } from '../../../domain/errors/sign-up-closed.error';
import {
  FakeIdentityGateway,
  InMemoryMembershipRepository,
  InMemoryRoleRepository,
  InMemoryTenantRepository,
} from '../../../testing/fakes';
import { SignUpGate } from '../../sign-up-gate';
import { GetSignUpAvailabilityUseCase } from './get-sign-up-availability.use-case';
import { SignUpUseCase } from './sign-up.use-case';

describe('SignUpUseCase', () => {
  let tenants: InMemoryTenantRepository;
  let roles: InMemoryRoleRepository;
  let memberships: InMemoryMembershipRepository;
  let identity: FakeIdentityGateway;
  let unitOfWork: ImmediateUnitOfWork;
  let events: RecordingEventBus;
  let useCase: SignUpUseCase;
  let settings: { publicSignupEnabled: boolean };
  let availability: GetSignUpAvailabilityUseCase;

  beforeEach(() => {
    tenants = new InMemoryTenantRepository();
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository();
    identity = new FakeIdentityGateway();
    unitOfWork = new ImmediateUnitOfWork();
    events = new RecordingEventBus();
    settings = { publicSignupEnabled: true };
    const gate = new SignUpGate(tenants, settings);
    availability = new GetSignUpAvailabilityUseCase(gate);
    useCase = new SignUpUseCase(
      tenants,
      roles,
      memberships,
      identity,
      unitOfWork,
      new SequentialIdGenerator(),
      events,
      gate,
    );
  });

  const signUp = (accountName = 'Padaria do Zé', email = 'ze@padaria.com') =>
    useCase.execute({ accountName, name: 'Zé', email, password: 'super-secret' });

  it('creates the tenant with the default roles', async () => {
    const { tenant } = await signUp();

    expect(tenant.slug.value).toBe('padaria-do-ze');
    expect(roles.roles.map((r) => r.key)).toEqual(['owner', 'admin', 'supervisor', 'agent']);
    expect(roles.roles.every((r) => r.tenantId === tenant.id)).toBe(true);
  });

  it('without a platform root, the account has no parent; with one, it is born below it', async () => {
    const { tenant: first } = await signUp('Primeira', 'a@x.com');
    expect(first.parentId).toBeNull();

    const platform = await tenants.findById(first.id);
    platform!.markRoot();
    await tenants.save(platform!);

    const { tenant } = await signUp('Segunda', 'b@x.com');
    expect(tenant.parentId).toBe(first.id);
    expect(tenant.ancestors).toEqual([first.id]);
  });

  it('makes the new user an active Owner of the tenant', async () => {
    const { tenant, userId } = await signUp();

    const [membership] = memberships.memberships;
    const owner = roles.roles.find((r) => r.key === 'owner')!;
    expect(membership.userId).toBe(userId);
    expect(membership.tenantId).toBe(tenant.id);
    expect(membership.roleId).toBe(owner.id);
    expect(membership.isActive).toBe(true);
  });

  it('opens a session in the new tenant', async () => {
    const { tenant, tokens } = await signUp();

    expect(tokens.accessToken).toBe(`access-for-${tenant.id}`);
    expect(identity.sessions).toEqual([
      { userId: 'user-1', tenantId: tenant.id, membershipId: memberships.memberships[0].id },
    ]);
  });

  it('does everything inside a single unit of work', async () => {
    await signUp();

    expect(unitOfWork.runs).toBe(1);
    expect(events.published[0]).toBeInstanceOf(TenantCreatedEvent);
  });

  /** A primeira conta vira a raiz, como o `designate-root` faria. */
  async function designateRoot(id: string) {
    const platform = await tenants.findById(id);
    platform!.markRoot();
    await tenants.save(platform!);
  }

  it('adds a suffix when the slug is already taken', async () => {
    const { tenant: first } = await signUp('Padaria do Zé', 'a@padaria.com');
    await designateRoot(first.id);
    const { tenant } = await signUp('Padaria do Zé', 'b@padaria.com');

    expect(tenant.slug.value).not.toBe('padaria-do-ze');
    expect(tenant.slug.value.startsWith('padaria-do-ze-')).toBe(true);
  });

  it('validates the account name before creating the user', async () => {
    await expect(signUp('X')).rejects.toThrow(InvalidTenantNameError);
    expect(identity.users).toHaveLength(0);
  });

  describe('public sign-up gate (PUBLIC_SIGNUP_ENABLED + platform root)', () => {
    it('before the root exists, accepts only the first account (the future root)', async () => {
      await signUp('Plataforma', 'dono@plataforma.com');

      await expect(signUp('Intrusa', 'x@intrusa.com')).rejects.toMatchObject({
        code: 'SIGNUP_PLATFORM_NOT_READY',
      });
      // Nada foi criado pela segunda tentativa.
      expect(tenants.tenants).toHaveLength(1);
      expect(identity.users).toHaveLength(1);
      await expect(availability.execute()).resolves.toEqual({ enabled: false });
    });

    it('accepts the first account even with public sign-up disabled (bootstrap)', async () => {
      settings.publicSignupEnabled = false;
      await expect(availability.execute()).resolves.toEqual({ enabled: true });

      const { tenant } = await signUp('Plataforma', 'dono@plataforma.com');

      expect(tenant.parentId).toBeNull();
    });

    it('with the root designated and sign-up disabled, refuses before creating anything', async () => {
      settings.publicSignupEnabled = false;
      const { tenant: platform } = await signUp('Plataforma', 'dono@plataforma.com');
      await designateRoot(platform.id);

      const attempt = signUp('Cliente', 'c@cliente.com');
      await expect(attempt).rejects.toBeInstanceOf(SignUpClosedError);
      await expect(attempt).rejects.toMatchObject({ code: 'SIGNUP_DISABLED' });
      expect(tenants.tenants).toHaveLength(1);
      expect(identity.users).toHaveLength(1);
      expect(identity.sessions).toHaveLength(1);
      await expect(availability.execute()).resolves.toEqual({ enabled: false });
    });

    it('with the root designated and sign-up enabled, the account is born below the root', async () => {
      const { tenant: platform } = await signUp('Plataforma', 'dono@plataforma.com');
      await designateRoot(platform.id);
      await expect(availability.execute()).resolves.toEqual({ enabled: true });

      const { tenant } = await signUp('Cliente', 'c@cliente.com');

      expect(tenant.parentId).toBe(platform.id);
    });
  });
});
