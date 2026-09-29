import type { AutomationRule, TriggerType } from '../../domain/automation-rule.entity';

/** Regras de automação. Tudo restrito ao tenant atual, exceto o que diz "AllTenants". */
export interface AutomationRuleRepository {
  save(rule: AutomationRule): Promise<void>;
  findById(id: string): Promise<AutomationRule | null>;
  listByBoard(boardId: string): Promise<AutomationRule[]>;
  /** Ativas, da coluna, com este gatilho. */
  listEnabledForColumn(columnId: string, trigger: TriggerType): Promise<AutomationRule[]>;
  /**
   * Ativas, do quadro, que movem o card para a própria coluna neste evento
   * (`dispositionId` filtra o gatilho de tabulação).
   */
  listEnabledMoveInto(
    boardId: string,
    trigger: TriggerType,
    dispositionId?: string,
  ): Promise<AutomationRule[]>;
  countForColumn(columnId: string): Promise<number>;
  delete(rule: AutomationRule): Promise<void>;
  /** Regras de tempo parado ativas de TODAS as contas (o sweep do worker). */
  listEnabledIdleAllTenants(): Promise<{ id: string; tenantId: string }[]>;
}

export const AUTOMATION_RULE_REPOSITORY = Symbol('AutomationRuleRepository');
