import type { TenantContext } from '../../../shared/application/tenant-context';
import type { MemberDirectory } from '../application/ports/member-directory';
import type { TeamRepository } from '../application/ports/team.repository';
import { TeamNameTakenError } from '../domain/errors/team-name-taken.error';
import type { Team } from '../domain/team.entity';

/** Reproduz o repositório real: isolado por tenant, nome único, ordem por nome. */
export class InMemoryTeamRepository implements TeamRepository {
  private items: Team[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((t) => t.tenantId === this.tenant.tenantId);
  }

  save(team: Team): Promise<void> {
    if (this.ofTenant().some((t) => t.id !== team.id && t.name === team.name)) {
      return Promise.reject(new TeamNameTakenError());
    }
    this.items = [...this.items.filter((t) => t.id !== team.id), team];
    return Promise.resolve();
  }

  findById(id: string): Promise<Team | null> {
    return Promise.resolve(this.ofTenant().find((t) => t.id === id) ?? null);
  }

  findByIds(ids: string[]): Promise<Team[]> {
    return Promise.resolve(this.ofTenant().filter((t) => ids.includes(t.id)));
  }

  list(): Promise<Team[]> {
    return Promise.resolve(this.ofTenant().sort((a, b) => a.name.localeCompare(b.name)));
  }

  delete(team: Team): Promise<void> {
    this.items = this.items.filter((t) => t.id !== team.id);
    return Promise.resolve();
  }

  teamIdsOf(membershipId: string): Promise<string[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((t) => t.memberIds.includes(membershipId))
        .map((t) => t.id),
    );
  }
}

export class FakeMemberDirectory implements MemberDirectory {
  constructor(private readonly active: string[]) {}

  activeMemberIds(ids: string[]): Promise<string[]> {
    return Promise.resolve(ids.filter((id) => this.active.includes(id)));
  }
}
