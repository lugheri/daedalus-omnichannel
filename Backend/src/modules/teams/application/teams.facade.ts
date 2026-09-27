import { Inject, Injectable } from '@nestjs/common';
import { TEAM_REPOSITORY, type TeamRepository } from './ports/team.repository';

export interface TeamSummary {
  id: string;
  name: string;
}

/**
 * API síncrona do módulo para outros módulos: conversations (escopo
 * `view:team`, transferência), channels (equipe do canal) e realtime (salas).
 */
@Injectable()
export class TeamsFacade {
  constructor(@Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository) {}

  /** Equipes de que o membro faz parte, no tenant atual. */
  teamIdsOf(membershipId: string): Promise<string[]> {
    return this.teams.teamIdsOf(membershipId);
  }

  async findByIds(ids: string[]): Promise<TeamSummary[]> {
    if (ids.length === 0) return [];
    const teams = await this.teams.findByIds([...new Set(ids)]);
    return teams.map((team) => ({ id: team.id, name: team.name }));
  }

  async exists(id: string): Promise<boolean> {
    return (await this.teams.findById(id)) !== null;
  }
}
