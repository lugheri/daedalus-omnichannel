/**
 * Quem é o membro da requisição e o que ele pode ver. Adapter em infra/
 * sobre a AccountsFacade.
 */
export interface CurrentMember {
  membershipId: string;
  permissions: readonly string[];
}

export interface MemberAccess {
  current(): Promise<CurrentMember>;
}

export const MEMBER_ACCESS = Symbol('MemberAccess');
