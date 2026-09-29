/** Equipes (módulo teams), para a entrada automática por equipe. */
export interface TeamDirectory {
  exists(teamId: string): Promise<boolean>;
}

export const TEAM_DIRECTORY = Symbol('KanbanTeamDirectory');
