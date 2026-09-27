import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { InvalidTeamMembersError } from '../../domain/errors/invalid-team-members.error';
import { TeamNotFoundError } from '../../domain/errors/team-not-found.error';
import { Team } from '../../domain/team.entity';
import { MEMBER_DIRECTORY, type MemberDirectory } from '../ports/member-directory';
import { TEAM_REPOSITORY, type TeamRepository } from '../ports/team.repository';

async function load(teams: TeamRepository, id: string): Promise<Team> {
  const team = await teams.findById(id);
  if (!team) throw new TeamNotFoundError();
  return team;
}

@Injectable()
export class ListTeamsUseCase {
  constructor(@Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository) {}

  execute(): Promise<Team[]> {
    return this.teams.list();
  }
}

@Injectable()
export class CreateTeamUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { name: string }): Promise<Team> {
    const team = Team.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      name: input.name,
    });
    await this.teams.save(team);
    return team;
  }
}

@Injectable()
export class RenameTeamUseCase {
  constructor(@Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository) {}

  async execute(input: { teamId: string; name: string }): Promise<Team> {
    const team = await load(this.teams, input.teamId);
    team.rename(input.name);
    await this.teams.save(team);
    return team;
  }
}

/** Substitui os membros; todos precisam ser membros ATIVOS da conta. */
@Injectable()
export class SetTeamMembersUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
    @Inject(MEMBER_DIRECTORY) private readonly members: MemberDirectory,
  ) {}

  async execute(input: { teamId: string; memberIds: string[] }): Promise<Team> {
    const team = await load(this.teams, input.teamId);
    const wanted = [...new Set(input.memberIds)];
    const active = await this.members.activeMemberIds(wanted);
    if (active.length !== wanted.length) throw new InvalidTeamMembersError();

    team.setMembers(wanted);
    await this.teams.save(team);
    return team;
  }
}

/**
 * Exclui a equipe. Canais e conversas dela voltam para a fila geral — cada
 * módulo reage ao `team.deleted.v1` (gravado no outbox, na mesma transação).
 */
@Injectable()
export class DeleteTeamUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(teamId: string): Promise<void> {
    await this.unitOfWork.run(async () => {
      const team = await load(this.teams, teamId);
      team.delete();
      await this.teams.delete(team);
      await this.events.publish(team.pullEvents());
    });
  }
}
