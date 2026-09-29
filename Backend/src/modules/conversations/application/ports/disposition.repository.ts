import type { Disposition } from '../../domain/disposition.entity';

/** Catálogo de tabulações da conta. Tudo restrito ao tenant atual (TenantContext). */
export interface DispositionRepository {
  save(disposition: Disposition): Promise<void>;
  findById(id: string): Promise<Disposition | null>;
  /** Por nome, sem diferenciar maiúsculas (inclui as arquivadas). */
  findByName(name: string): Promise<Disposition | null>;
  /** Todas (ativas e arquivadas), por nome. */
  list(): Promise<Disposition[]>;
  /** Há alguma ativa? Então resolver um atendimento exige tabulação. */
  hasActive(): Promise<boolean>;
  /** Já foi usada em algum atendimento? */
  isUsed(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}

export const DISPOSITION_REPOSITORY = Symbol('DispositionRepository');
