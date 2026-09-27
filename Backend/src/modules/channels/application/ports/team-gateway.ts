/**
 * O que channels precisa do módulo teams. Adapter em infra/ sobre a TeamsFacade.
 */
export interface TeamGateway {
  exists(teamId: string): Promise<boolean>;
  findByIds(ids: string[]): Promise<{ id: string; name: string }[]>;
}

export const TEAM_GATEWAY = Symbol('TeamGateway');
