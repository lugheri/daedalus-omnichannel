import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type {
  AutomationRuleModel,
  AutomationRunModel,
  BoardCardModel,
} from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { AutomationRuleRepository } from '../application/ports/automation-rule.repository';
import type {
  ActionResult,
  AutomationRun,
  AutomationRunRepository,
  RunStatus,
} from '../application/ports/automation-run.repository';
import {
  AutomationRule,
  type AutomationAction,
  type AutomationTrigger,
  type TriggerType,
} from '../domain/automation-rule.entity';
import { BoardCard } from '../domain/board-card.entity';
import { isUuid } from './uuid';

@Injectable()
export class PrismaAutomationRuleRepository implements AutomationRuleRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(rule: AutomationRule): Promise<void> {
    const { trigger } = rule;
    const data = {
      triggerType: trigger.type,
      idleMinutes: trigger.type === 'card_idle' ? trigger.minutes : null,
      dispositionId: trigger.type === 'disposition_set' ? trigger.dispositionId : null,
      actions: rule.actions as unknown as Prisma.InputJsonValue,
      enabled: rule.enabled,
      activeSince: rule.activeSince,
    };
    await this.db.automationRule.upsert({
      where: { id: rule.id, tenantId: this.tenant.tenantId },
      create: {
        id: rule.id,
        tenantId: this.tenant.tenantId,
        boardId: rule.boardId,
        columnId: rule.columnId,
        createdAt: rule.createdAt,
        ...data,
      },
      update: data,
    });
  }

  async findById(id: string): Promise<AutomationRule | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.automationRule.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toRule(row) : null;
  }

  async listByBoard(boardId: string): Promise<AutomationRule[]> {
    const rows = await this.db.automationRule.findMany({
      where: { boardId, tenantId: this.tenant.tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRule);
  }

  async listEnabledForColumn(columnId: string, trigger: TriggerType): Promise<AutomationRule[]> {
    const rows = await this.db.automationRule.findMany({
      where: { columnId, tenantId: this.tenant.tenantId, triggerType: trigger, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRule);
  }

  async listEnabledMoveInto(
    boardId: string,
    trigger: TriggerType,
    dispositionId?: string,
  ): Promise<AutomationRule[]> {
    const rows = await this.db.automationRule.findMany({
      where: {
        boardId,
        tenantId: this.tenant.tenantId,
        triggerType: trigger,
        enabled: true,
        ...(dispositionId && { dispositionId }),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRule);
  }

  countForColumn(columnId: string): Promise<number> {
    return this.db.automationRule.count({ where: { columnId, tenantId: this.tenant.tenantId } });
  }

  async delete(rule: AutomationRule): Promise<void> {
    await this.db.automationRule.deleteMany({
      where: { id: rule.id, tenantId: this.tenant.tenantId },
    });
  }

  /** Sem filtro de tenant, de propósito: é o sweep do sistema que distribui por conta. */
  listEnabledIdleAllTenants(): Promise<{ id: string; tenantId: string }[]> {
    return this.db.automationRule.findMany({
      where: { triggerType: 'card_idle', enabled: true },
      select: { id: true, tenantId: true },
    });
  }
}

@Injectable()
export class PrismaAutomationRunRepository implements AutomationRunRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async start(run: AutomationRun): Promise<boolean> {
    try {
      await this.db.automationRun.create({
        data: {
          ...run,
          tenantId: this.tenant.tenantId,
          results: run.results as unknown as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error) {
      // Mesmo disparo já registrado (regra + chave): não roda de novo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async finish(runId: string, status: RunStatus, results: ActionResult[]): Promise<void> {
    await this.db.automationRun.updateMany({
      where: { id: runId, tenantId: this.tenant.tenantId },
      data: {
        status,
        results: results as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  }

  async listByRule(ruleId: string, limit: number): Promise<AutomationRun[]> {
    const rows = await this.db.automationRun.findMany({
      where: { ruleId, tenantId: this.tenant.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toRun);
  }

  async dueIdleCards(rule: AutomationRule, now: Date, limit: number): Promise<BoardCard[]> {
    if (rule.trigger.type !== 'card_idle') return [];
    const before = new Date(now.getTime() - rule.trigger.minutes * 60_000);
    // Conta a partir do que for mais recente: a entrada na coluna ou a
    // ativação da regra. A chave do disparo repete idleDedupeKey().
    const rows = await this.db.$queryRaw<BoardCardModel[]>`
      SELECT c.id, c.tenant_id AS "tenantId", c.board_id AS "boardId", c.column_id AS "columnId",
             c.conversation_id AS "conversationId", c.position,
             c.entered_column_at AS "enteredColumnAt", c.created_at AS "createdAt"
      FROM kanban.board_cards c
      WHERE c.tenant_id = ${this.tenant.tenantId}::uuid
        AND c.column_id = ${rule.columnId}::uuid
        AND greatest(c.entered_column_at, ${rule.activeSince}) <= ${before}
        AND NOT EXISTS (
          SELECT 1 FROM kanban.automation_runs r
          WHERE r.rule_id = ${rule.id}::uuid
            AND r.dedupe_key = c.id::text || ':' ||
                floor(extract(epoch from c.entered_column_at) * 1000)::bigint::text
        )
      ORDER BY c.entered_column_at
      LIMIT ${limit}`;
    return rows.map((row) => BoardCard.restore(row.id, row));
  }
}

function toRule(row: AutomationRuleModel): AutomationRule {
  const trigger: AutomationTrigger =
    row.triggerType === 'card_idle'
      ? { type: 'card_idle', minutes: row.idleMinutes ?? 1 }
      : row.triggerType === 'disposition_set'
        ? { type: 'disposition_set', dispositionId: row.dispositionId ?? '' }
        : {
            type: row.triggerType as 'card_entered' | 'conversation_resolved' | 'customer_replied',
          };
  return AutomationRule.restore(row.id, {
    tenantId: row.tenantId,
    boardId: row.boardId,
    columnId: row.columnId,
    trigger,
    actions: row.actions as unknown as AutomationAction[],
    enabled: row.enabled,
    activeSince: row.activeSince,
    createdAt: row.createdAt,
  });
}

function toRun(row: AutomationRunModel): AutomationRun {
  return {
    id: row.id,
    tenantId: row.tenantId,
    ruleId: row.ruleId,
    cardId: row.cardId,
    conversationId: row.conversationId,
    dedupeKey: row.dedupeKey,
    status: row.status as RunStatus,
    results: row.results as unknown as ActionResult[],
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}
