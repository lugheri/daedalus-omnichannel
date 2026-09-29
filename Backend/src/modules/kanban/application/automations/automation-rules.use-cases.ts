import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import {
  AutomationRule,
  type AutomationAction,
  type AutomationTrigger,
} from '../../domain/automation-rule.entity';
import type { Board } from '../../domain/board.entity';
import { AutomationNotFoundError } from '../../domain/errors/automation-not-found.error';
import { InvalidAutomationError } from '../../domain/errors/invalid-automation.error';
import {
  AUTOMATION_RULE_REPOSITORY,
  type AutomationRuleRepository,
} from '../ports/automation-rule.repository';
import {
  AUTOMATION_RUN_REPOSITORY,
  type AutomationRun,
  type AutomationRunRepository,
} from '../ports/automation-run.repository';
import { CONVERSATION_ACTIONS, type ConversationActions } from '../ports/conversation-actions';
import { MEMBER_DIRECTORY, type MemberDirectory } from '../ports/member-directory';
import { TEAM_DIRECTORY, type TeamDirectory } from '../ports/team-directory';
import { BoardsReader } from '../use-cases/boards.use-cases';

/** Regras por coluna — suficiente para qualquer fluxo sensato, e limita o custo por card. */
export const MAX_RULES_PER_COLUMN = 10;

/**
 * Confere as referências de uma regra: a coluna de destino é do quadro, a
 * equipe existe, a pessoa está ativa, a tabulação existe.
 */
@Injectable()
export class AutomationReferences {
  constructor(
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
    @Inject(MEMBER_DIRECTORY) private readonly members: MemberDirectory,
    @Inject(CONVERSATION_ACTIONS) private readonly conversations: ConversationActions,
  ) {}

  async assertValid(board: Board, rule: AutomationRule): Promise<void> {
    const { trigger } = rule;
    if (
      trigger.type === 'disposition_set' &&
      !(await this.conversations.dispositionExists(trigger.dispositionId))
    ) {
      throw new InvalidAutomationError('AUTOMATION_INVALID_DISPOSITION');
    }
    for (const action of rule.actions) {
      if (action.type === 'move' && !board.hasColumn(action.columnId)) {
        throw new InvalidAutomationError('AUTOMATION_INVALID_MOVE');
      }
      if (action.type === 'assign') {
        if (action.teamId && !(await this.teams.exists(action.teamId))) {
          throw new InvalidAutomationError('AUTOMATION_INVALID_TEAM');
        }
        if (action.assigneeId && !(await this.members.isActive(action.assigneeId))) {
          throw new InvalidAutomationError('AUTOMATION_INVALID_ASSIGNEE');
        }
      }
    }
  }
}

/** Regras do quadro (todas as colunas). */
@Injectable()
export class ListAutomationsUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
  ) {}

  async execute(boardId: string): Promise<AutomationRule[]> {
    const board = await this.boards.get(boardId);
    return this.rules.listByBoard(board.id);
  }
}

@Injectable()
export class CreateAutomationUseCase {
  constructor(
    private readonly boards: BoardsReader,
    private readonly references: AutomationReferences,
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(
    boardId: string,
    input: {
      columnId: string;
      trigger: AutomationTrigger;
      actions: AutomationAction[];
      enabled?: boolean;
    },
  ): Promise<AutomationRule> {
    const board = await this.boards.get(boardId);
    board.column(input.columnId);
    if ((await this.rules.countForColumn(input.columnId)) >= MAX_RULES_PER_COLUMN) {
      throw new InvalidAutomationError('AUTOMATION_TOO_MANY');
    }
    const rule = AutomationRule.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      boardId: board.id,
      ...input,
    });
    await this.references.assertValid(board, rule);
    await this.rules.save(rule);
    return rule;
  }
}

/** Regra do quadro, ou 404 (inclusive de outro quadro). */
async function ruleOf(rules: AutomationRuleRepository, board: Board, ruleId: string) {
  const rule = await rules.findById(ruleId);
  if (!rule || rule.boardId !== board.id) throw new AutomationNotFoundError();
  return rule;
}

@Injectable()
export class UpdateAutomationUseCase {
  constructor(
    private readonly boards: BoardsReader,
    private readonly references: AutomationReferences,
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
  ) {}

  /** Campo ausente = não muda. */
  async execute(
    boardId: string,
    ruleId: string,
    input: { trigger?: AutomationTrigger; actions?: AutomationAction[]; enabled?: boolean },
  ): Promise<AutomationRule> {
    const board = await this.boards.get(boardId);
    const rule = await ruleOf(this.rules, board, ruleId);
    rule.update(input);
    await this.references.assertValid(board, rule);
    await this.rules.save(rule);
    return rule;
  }
}

@Injectable()
export class DeleteAutomationUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
  ) {}

  async execute(boardId: string, ruleId: string): Promise<void> {
    const board = await this.boards.get(boardId);
    await this.rules.delete(await ruleOf(this.rules, board, ruleId));
  }
}

/** Últimas execuções de uma regra (para conferir o que aconteceu). */
@Injectable()
export class ListAutomationRunsUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
    @Inject(AUTOMATION_RUN_REPOSITORY) private readonly runs: AutomationRunRepository,
  ) {}

  async execute(boardId: string, ruleId: string): Promise<AutomationRun[]> {
    const board = await this.boards.get(boardId);
    const rule = await ruleOf(this.rules, board, ruleId);
    return this.runs.listByRule(rule.id, 20);
  }
}
