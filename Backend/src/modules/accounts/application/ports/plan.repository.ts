import type { Plan } from '../../domain/plan.entity';

/**
 * Catálogo de planos (ADR 0015). Não é de nenhuma conta: sem filtro de
 * tenant (quem mexe é a conta da plataforma, conferido no use case).
 */
export interface PlanRepository {
  save(plan: Plan): Promise<void>;
  findById(id: string): Promise<Plan | null>;
  /** O plano de quem não tem plano escolhido. */
  findDefault(): Promise<Plan | null>;
  /** Por nome (arquivados também). */
  list(): Promise<Plan[]>;
  delete(plan: Plan): Promise<void>;
  /** Quantas contas estão no plano (no padrão: também as sem plano escolhido). */
  countAccountsUsing(plan: Plan): Promise<number>;
}

export const PLAN_REPOSITORY = Symbol('PlanRepository');
