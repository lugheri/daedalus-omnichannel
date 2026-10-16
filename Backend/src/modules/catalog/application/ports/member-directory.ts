/**
 * O que catalog precisa do módulo accounts: saber quais vínculos são membros
 * ativos da conta (para vincular um profissional a quem tem login).
 */
export interface MemberDirectory {
  activeMemberIds(ids: string[]): Promise<string[]>;
}

export const MEMBER_DIRECTORY = Symbol('CatalogMemberDirectory');
