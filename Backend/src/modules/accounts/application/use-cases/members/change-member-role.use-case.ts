import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { RoleNotFoundError } from '../../../domain/errors/role-not-found.error';
import { assertCanGrant } from '../../account-access';
import { CurrentAccess } from '../../current-access';
import { ACCESS_CACHE, type AccessCache } from '../../ports/access-cache';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { ensureAnotherOwnerRemains, loadMember } from './member-guards';

@Injectable()
export class ChangeMemberRoleUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(ACCESS_CACHE) private readonly cache: AccessCache,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: { membershipId: string; roleId: string }): Promise<void> {
    const access = await this.currentAccess.get();

    await this.unitOfWork.run(async () => {
      const { membership, role: currentRole } = await loadMember(
        { memberships: this.memberships, roles: this.roles },
        access.tenantId,
        input.membershipId,
      );
      const newRole = await this.roles.findInTenant(access.tenantId, input.roleId);
      if (!newRole) throw new RoleNotFoundError();

      // Só administra quem não é "mais poderoso" que você, e só dá o que você tem.
      assertCanGrant(access, currentRole.permissions);
      assertCanGrant(access, newRole.permissions);
      if (!newRole.isOwner)
        await ensureAnotherOwnerRemains(this.memberships, membership, currentRole);

      membership.changeRole(newRole.id);
      await this.memberships.save(membership);
    });

    await this.cache.invalidate([input.membershipId]);
  }
}
