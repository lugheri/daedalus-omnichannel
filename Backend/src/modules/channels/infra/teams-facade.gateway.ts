import { Injectable } from '@nestjs/common';
import { TeamsFacade } from '../../teams';
import type { TeamGateway } from '../application/ports/team-gateway';

/** Adapter do port TeamGateway sobre a API pública do módulo teams. */
@Injectable()
export class TeamsFacadeGateway implements TeamGateway {
  constructor(private readonly teams: TeamsFacade) {}

  exists(teamId: string): Promise<boolean> {
    return this.teams.exists(teamId);
  }

  findByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
    return this.teams.findByIds(ids);
  }
}
