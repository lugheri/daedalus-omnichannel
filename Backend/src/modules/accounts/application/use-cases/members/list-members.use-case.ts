import { Inject, Injectable } from '@nestjs/common';
import type { MembershipStatus } from '../../../domain/membership.entity';
import type { Role } from '../../../domain/role.entity';
import { CurrentAccess } from '../../current-access';
import {
  IDENTITY_GATEWAY,
  type IdentityGateway,
  type UserInfo,
} from '../../ports/identity.gateway';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';

export interface MemberView {
  membershipId: string;
  user: UserInfo;
  role: Role;
  status: MembershipStatus;
  joinedAt: Date;
}

@Injectable()
export class ListMembersUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
  ) {}

  async execute(): Promise<MemberView[]> {
    const { tenantId } = await this.currentAccess.get();
    const [memberships, roles] = await Promise.all([
      this.memberships.listByTenant(tenantId),
      this.roles.listByTenant(tenantId),
    ]);
    const users = await this.identity.findUsers(memberships.map((m) => m.userId));

    return memberships.flatMap((membership) => {
      const user = users.find((u) => u.id === membership.userId);
      const role = roles.find((r) => r.id === membership.roleId);
      if (!user || !role) return [];
      return [
        {
          membershipId: membership.id,
          user,
          role,
          status: membership.status,
          joinedAt: membership.createdAt,
        },
      ];
    });
  }
}
