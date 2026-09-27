/**
 * O que conversations precisa do módulo teams (além das equipes do membro,
 * que vêm no MemberAccess). Adapter em infra/ sobre a TeamsFacade.
 */
export interface TeamInfo {
  id: string;
  name: string;
}

export interface TeamDirectory {
  findByIds(ids: string[]): Promise<TeamInfo[]>;
  exists(teamId: string): Promise<boolean>;
}

export const TEAM_DIRECTORY = Symbol('TeamDirectory');
