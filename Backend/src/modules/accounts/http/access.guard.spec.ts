import { Controller, Get, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from '../../../shared/http/public.decorator';
import { InMemoryActorContext } from '../../../shared/testing/fakes';
import { DEFAULT_ROLES } from '../domain/default-roles';
import { AccountAccessDeniedError } from '../domain/errors/account-access-denied.error';
import { MissingPermissionError } from '../domain/errors/missing-permission.error';
import { Membership } from '../domain/membership.entity';
import { Role } from '../domain/role.entity';
import { Slug } from '../domain/slug.vo';
import { Tenant } from '../domain/tenant.entity';
import { ResolveAccessUseCase } from '../application/use-cases/resolve-access/resolve-access.use-case';
import {
  InMemoryAccessCache,
  InMemoryMembershipRepository,
  InMemoryRoleRepository,
  InMemoryTenantRepository,
} from '../testing/fakes';
import { AccessGuard } from './access.guard';
import { RequireAnyPermission, RequirePermissions } from './require-permissions.decorator';

@RequirePermissions('contacts:view')
@Controller()
class ProbeController {
  @Get() list() {}
  @RequirePermissions('contacts:edit') @Get() create() {}
  @RequirePermissions('members:manage') @Get() manageMembers() {}
  @RequireAnyPermission('conversations:view:own', 'conversations:view:all') @Get() inbox() {}
  @Public() @Get() open() {}
}

type Handler = 'list' | 'create' | 'manageMembers' | 'inbox' | 'open';

function contextFor(handler: Handler) {
  return {
    // O Reflector só lê os metadados do método; ele nunca é chamado.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => ProbeController.prototype[handler],
    getClass: () => ProbeController,
  } as unknown as ExecutionContext;
}

describe('AccessGuard', () => {
  let memberships: InMemoryMembershipRepository;
  let actors: InMemoryActorContext;

  async function guardFor(roleKey: string) {
    const roles = new InMemoryRoleRepository();
    const tenants = new InMemoryTenantRepository();
    memberships = new InMemoryMembershipRepository();
    actors = new InMemoryActorContext();

    const template = DEFAULT_ROLES.find((r) => r.key === roleKey)!;
    await roles.saveMany([Role.fromTemplate('role-1', 'tenant-1', template)]);
    await tenants.save(
      Tenant.restore('tenant-1', {
        name: 'Loja',
        slug: Slug.fromName('loja'),
        status: 'active',
        createdAt: new Date(),
      }),
    );
    await memberships.save(
      Membership.createActive('membership-1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
      }),
    );
    actors.authenticate({
      userId: 'user-1',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      sessionId: 'session-1',
    });

    return new AccessGuard(
      new Reflector(),
      new ResolveAccessUseCase(memberships, roles, tenants, new InMemoryAccessCache()),
      actors,
    );
  }

  it('lets an agent read and edit contacts (class + method permissions)', async () => {
    const guard = await guardFor('agent');

    await expect(guard.canActivate(contextFor('list'))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor('create'))).resolves.toBe(true);
  });

  it('forbids an agent from managing members (403)', async () => {
    const guard = await guardFor('agent');

    await expect(guard.canActivate(contextFor('manageMembers'))).rejects.toThrow(
      MissingPermissionError,
    );
  });

  it('accepts any of the scoped variants', async () => {
    const guard = await guardFor('agent'); // tem conversations:view:own

    await expect(guard.canActivate(contextFor('inbox'))).resolves.toBe(true);
  });

  it('lets an admin manage members', async () => {
    const guard = await guardFor('admin');

    await expect(guard.canActivate(contextFor('manageMembers'))).resolves.toBe(true);
  });

  it('rejects everything once the membership is disabled (401), even without permissions', async () => {
    const guard = await guardFor('owner');
    await memberships.save(
      Membership.restore('membership-1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
        status: 'disabled',
        createdAt: new Date(),
      }),
    );

    await expect(guard.canActivate(contextFor('list'))).rejects.toThrow(AccountAccessDeniedError);
  });

  it('skips @Public() routes entirely', async () => {
    const guard = await guardFor('agent');

    await expect(guard.canActivate(contextFor('open'))).resolves.toBe(true);
  });
});
