import {
  ImmediateUnitOfWork,
  InMemoryActorContext,
  SequentialIdGenerator,
} from '../../../shared/testing/fakes';
import { CurrentAccess } from '../application/current-access';
import { ResolveAccessUseCase } from '../application/use-cases/resolve-access/resolve-access.use-case';
import { DEFAULT_ROLES, type SystemRoleKey } from '../domain/default-roles';
import { Membership } from '../domain/membership.entity';
import { Role } from '../domain/role.entity';
import { Slug } from '../domain/slug.vo';
import { Tenant } from '../domain/tenant.entity';
import {
  FakeIdentityGateway,
  InMemoryAccessCache,
  InMemoryInvitationRepository,
  InMemoryMembershipRepository,
  InMemoryRoleRepository,
  InMemoryTenantRepository,
  SequentialInvitationTokenGenerator,
} from './fakes';

export const TENANT_ID = 'tenant-1';
export const roleId = (key: SystemRoleKey) => `role-${key}`;

/**
 * Uma conta pronta para testes de gestão: os quatro cargos padrão, repositórios
 * em memória e helpers para criar membros e "agir como" um deles.
 */
export async function accountScenario() {
  const tenants = new InMemoryTenantRepository();
  const roles = new InMemoryRoleRepository();
  const memberships = new InMemoryMembershipRepository();
  const invitations = new InMemoryInvitationRepository();
  const cache = new InMemoryAccessCache();
  const identity = new FakeIdentityGateway();
  const actors = new InMemoryActorContext();
  const tokens = new SequentialInvitationTokenGenerator();
  const ids = new SequentialIdGenerator();
  const unitOfWork = new ImmediateUnitOfWork();
  const currentAccess = new CurrentAccess(
    actors,
    new ResolveAccessUseCase(memberships, roles, tenants, cache),
  );

  await tenants.save(
    Tenant.restore(TENANT_ID, {
      name: 'Loja',
      slug: Slug.fromName('loja'),
      status: 'active',
      createdAt: new Date(),
    }),
  );
  await roles.saveMany(DEFAULT_ROLES.map((t) => Role.fromTemplate(roleId(t.key), TENANT_ID, t)));

  /** Cria usuário + vínculo. O id do vínculo é `m-<nome>`. */
  async function addMember(name: string, key: SystemRoleKey, opts: { disabled?: boolean } = {}) {
    const { id: userId } = await identity.registerUser({
      email: `${name}@loja.com`,
      name,
      password: 'super-secret',
    });
    const membership = Membership.createActive(`m-${name}`, {
      tenantId: TENANT_ID,
      userId,
      roleId: roleId(key),
    });
    if (opts.disabled) membership.disable();
    await memberships.save(membership);
    return membership;
  }

  /** Autentica a requisição como o membro informado. */
  async function actAs(membershipId: string) {
    const membership = (await memberships.findById(membershipId))!;
    actors.authenticate({
      userId: membership.userId,
      tenantId: membership.tenantId,
      membershipId,
      sessionId: 'session',
    });
  }

  return {
    tenants,
    roles,
    memberships,
    invitations,
    cache,
    identity,
    tokens,
    ids,
    unitOfWork,
    currentAccess,
    settings: { appUrl: 'https://app.test' },
    addMember,
    actAs,
  };
}

export type AccountScenario = Awaited<ReturnType<typeof accountScenario>>;
