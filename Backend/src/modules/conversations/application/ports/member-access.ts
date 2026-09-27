/**
 * Quem é o membro da requisição e o que ele pode ver. Adapter em infra/
 * sobre as facades de accounts (permissões) e teams (equipes).
 */
export interface CurrentMember {
  membershipId: string;
  permissions: readonly string[];
  teamIds: readonly string[];
}

export interface MemberAccess {
  current(): Promise<CurrentMember>;
  /** Dos ids informados, os que são membros ATIVOS da conta. */
  activeMemberIds(ids: string[]): Promise<string[]>;
}

export const MEMBER_ACCESS = Symbol('MemberAccess');
