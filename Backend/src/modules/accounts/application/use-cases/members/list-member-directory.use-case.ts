import { Inject, Injectable } from '@nestjs/common';
import { CurrentAccess } from '../../current-access';
import { IDENTITY_GATEWAY, type IdentityGateway } from '../../ports/identity.gateway';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';

export interface DirectoryEntry {
  membershipId: string;
  name: string;
}

/**
 * Nomes dos colegas ATIVOS da conta — para as telas mostrarem "atribuída a
 * Fulano" e quem enviou cada mensagem. Aberto a qualquer membro: diferente
 * da gestão de membros, não expõe e-mail, cargo nem status.
 */
@Injectable()
export class ListMemberDirectoryUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
  ) {}

  async execute(): Promise<DirectoryEntry[]> {
    const { tenantId } = await this.currentAccess.get();
    const active = (await this.memberships.listByTenant(tenantId)).filter((m) => m.isActive);
    const users = await this.identity.findUsers(active.map((m) => m.userId));
    const nameOf = new Map(users.map((u) => [u.id, u.name]));

    return active
      .flatMap((m) => {
        const name = nameOf.get(m.userId);
        return name ? [{ membershipId: m.id, name }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}
