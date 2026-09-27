/**
 * O que teams precisa do módulo accounts: saber quais vínculos são membros
 * ativos da conta. Adapter em infra/ sobre a AccountsFacade.
 */
export interface MemberDirectory {
  activeMemberIds(ids: string[]): Promise<string[]>;
}

export const MEMBER_DIRECTORY = Symbol('MemberDirectory');
