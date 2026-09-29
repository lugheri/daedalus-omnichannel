import type { AutomationRun } from '../application/ports/automation-run.repository';
import type { AutomationRule } from '../domain/automation-rule.entity';

/** Formato público das automações na API. */
export const AutomationPresenter = {
  toHttp: (rule: AutomationRule) => ({
    id: rule.id,
    boardId: rule.boardId,
    columnId: rule.columnId,
    trigger: rule.trigger,
    actions: rule.actions,
    enabled: rule.enabled,
    activeSince: rule.activeSince.toISOString(),
    createdAt: rule.createdAt.toISOString(),
  }),
  run: (run: AutomationRun) => ({
    id: run.id,
    cardId: run.cardId,
    conversationId: run.conversationId,
    status: run.status,
    results: run.results,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  }),
};
