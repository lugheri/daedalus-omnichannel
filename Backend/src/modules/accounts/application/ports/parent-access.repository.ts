/** Uma entrada de alguém de uma conta acima nesta conta. */
export interface ParentAccessEntry {
  id: string;
  tenantId: string;
  membershipId: string;
  userId: string;
  fromTenantId: string;
  createdAt: Date;
}

/** Histórico de acessos da conta-mãe (a conta acessada vê). */
export interface ParentAccessRepository {
  record(entry: ParentAccessEntry): Promise<void>;
  /** Mais recentes primeiro. */
  listByTenant(tenantId: string, limit: number): Promise<ParentAccessEntry[]>;
}

export const PARENT_ACCESS_REPOSITORY = Symbol('ParentAccessRepository');
