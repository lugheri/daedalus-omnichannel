import {
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../../shared/testing/fakes';
import { InvalidTenantNameError } from '../../../domain/errors/invalid-tenant-name.error';
import { TenantCreatedEvent } from '../../../domain/events/tenant-created.event';
import {
  FakeIdentityGateway,
  InMemoryMembershipRepository,
  InMemoryRoleRepository,
  InMemoryTenantRepository,
} from '../../../testing/fakes';
import { SignUpUseCase } from './sign-up.use-case';

describe('SignUpUseCase', () => {
  let tenants: InMemoryTenantRepository;
  let roles: InMemoryRoleRepository;
  let memberships: InMemoryMembershipRepository;
  let identity: FakeIdentityGateway;
  let unitOfWork: ImmediateUnitOfWork;
  let events: RecordingEventBus;
  let useCase: SignUpUseCase;

  beforeEach(() => {
    tenants = new InMemoryTenantRepository();
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository();
    identity = new FakeIdentityGateway();
    unitOfWork = new ImmediateUnitOfWork();
    events = new RecordingEventBus();
    useCase = new SignUpUseCase(
      tenants,
      roles,
      memberships,
      identity,
      unitOfWork,
      new SequentialIdGenerator(),
      events,
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

  it('adds a suffix when the slug is already taken', async () => {
    await signUp('Padaria do Zé', 'a@padaria.com');
    const { tenant } = await signUp('Padaria do Zé', 'b@padaria.com');

    expect(tenant.slug.value).not.toBe('padaria-do-ze');
    expect(tenant.slug.value.startsWith('padaria-do-ze-')).toBe(true);
  });

  it('validates the account name before creating the user', async () => {
    await expect(signUp('X')).rejects.toThrow(InvalidTenantNameError);
    expect(identity.users).toHaveLength(0);
  });
});
