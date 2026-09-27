import type { Team } from '../../domain/team.entity';

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface TeamRepository {
  /** Grava equipe e membros. Lança `TeamNameTakenError` se o nome já existir. */
  save(team: Team): Promise<void>;
  findById(id: string): Promise<Team | null>;
  findByIds(ids: string[]): Promise<Team[]>;
  /** Por nome. */
  list(): Promise<Team[]>;
  delete(team: Team): Promise<void>;
  /** Equipes de que o membro faz parte. */
  teamIdsOf(membershipId: string): Promise<string[]>;
}

export const TEAM_REPOSITORY = Symbol('TeamRepository');
