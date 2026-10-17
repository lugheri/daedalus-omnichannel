import type { Deal } from '../../domain/deal.entity';
import type { AutomationRule } from '../../domain/automation-rule.entity';

export type RunStatus = 'running' | 'succeeded' | 'failed';

export interface ActionResult {
  type: string;
  ok: boolean;
  /** Código do erro (ex.: CHANNEL_NOT_CONNECTED) ou motivo de ter pulado. */
  error?: string;
}

export interface AutomationRun {
  id: string;
  tenantId: string;
  ruleId: string;
  dealId: string;
  conversationId: string | null;
  /** Único por regra: o mesmo disparo nunca roda duas vezes. */
  dedupeKey: string;
  status: RunStatus;
  results: ActionResult[];
  createdAt: Date;
  finishedAt: Date | null;
}

/** Execuções das regras (tenant atual). */
export interface AutomationRunRepository {
  /** Registra o início; `false` se esse disparo já foi registrado antes. */
  start(run: AutomationRun): Promise<boolean>;
  finish(runId: string, status: RunStatus, results: ActionResult[]): Promise<void>;
  /** Mais recentes primeiro. */
  listByRule(ruleId: string, limit: number): Promise<AutomationRun[]>;
  /**
   * Negócios em aberto da etapa da regra parados há `minutes` ou mais
   * (contando a partir de quando a regra ficou ativa) e ainda sem execução
   * nesta entrada.
   */
  dueIdleDeals(rule: AutomationRule, now: Date, limit: number): Promise<Deal[]>;
}

export const AUTOMATION_RUN_REPOSITORY = Symbol('AutomationRunRepository');

/** Chave do disparo por tempo parado: uma vez por entrada do negócio na etapa. */
export function idleDedupeKey(deal: { id: string; enteredColumnAt: Date }): string {
  return `${deal.id}:${deal.enteredColumnAt.getTime()}`;
}
