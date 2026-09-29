/** Membros (módulo accounts), para validar o responsável das automações. */
export interface MemberDirectory {
  isActive(membershipId: string): Promise<boolean>;
}

export const MEMBER_DIRECTORY = Symbol('KanbanMemberDirectory');
