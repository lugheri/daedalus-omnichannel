import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { RoleInUseError } from '../../../domain/errors/role-in-use.error';
import { RoleNotFoundError } from '../../../domain/errors/role-not-found.error';
import type { Permission } from '../../../domain/permissions';
import { Role } from '../../../domain/role.entity';
import { assertCanGrant } from '../../account-access';
import { CurrentAccess } from '../../current-access';
import { ACCESS_CACHE, type AccessCache } from '../../ports/access-cache';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';

@Injectable()
export class ListRolesUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  async execute(): Promise<Role[]> {
    const { tenantId } = await this.currentAccess.get();
    return this.roles.listByTenant(tenantId);
  }
}

@Injectable()
export class CreateRoleUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { name: string; permissions: Permission[] }): Promise<Role> {
    const access = await this.currentAccess.get();
    assertCanGrant(access, input.permissions);

    const role = Role.createCustom(this.ids.generate(), { tenantId: access.tenantId, ...input });
    await this.roles.save(role);
    return role;
  }
}

/**
 * Edita um cargo. Mudar permissões afeta na hora todos os membros com ele:
 * o cache de acesso de cada um é invalidado.
 */
@Injectable()
export class UpdateRoleUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(ACCESS_CACHE) private readonly cache: AccessCache,
  ) {}

  async execute(input: {
    roleId: string;
    name?: string;
    permissions?: Permission[];
  }): Promise<Role> {
    const access = await this.currentAccess.get();
    const role = await this.roles.findInTenant(access.tenantId, input.roleId);
    if (!role) throw new RoleNotFoundError();

    // Não edita cargo "acima" do seu, nem adiciona o que você não tem.
    assertCanGrant(access, role.permissions);
    if (input.permissions) assertCanGrant(access, input.permissions);

    role.update({ name: input.name, permissions: input.permissions });
    await this.roles.save(role);

    await this.cache.invalidate(await this.memberships.listIdsWithRole(access.tenantId, role.id));
    return role;
  }
}

/** Exclui um cargo que ninguém usa (nem membros, nem convites pendentes). */
@Injectable()
export class DeleteRoleUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(roleId: string): Promise<void> {
    const access = await this.currentAccess.get();

    await this.unitOfWork.run(async () => {
      const role = await this.roles.findInTenant(access.tenantId, roleId);
      if (!role) throw new RoleNotFoundError();
      role.assertDeletable();
      assertCanGrant(access, role.permissions);

      const [members, invitations] = await Promise.all([
        this.memberships.listIdsWithRole(access.tenantId, role.id),
        this.invitations.countPendingWithRole(access.tenantId, role.id),
      ]);
      if (members.length > 0 || invitations > 0) throw new RoleInUseError();

      await this.roles.delete(role);
    });
  }
}
