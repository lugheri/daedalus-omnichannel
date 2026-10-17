import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { AutomationAction, AutomationRule } from '../../domain/automation-rule.entity';
import type { Deal } from '../../domain/deal.entity';
import { positionBetween } from '../../domain/card-position';
import { renderTemplate } from '../../../../shared/domain/message-template';
import {
  AUTOMATION_RUN_REPOSITORY,
  type ActionResult,
  type AutomationRunRepository,
} from '../ports/automation-run.repository';
import { CONVERSATION_ACTIONS, type ConversationActions } from '../ports/conversation-actions';
import { DEAL_REPOSITORY, type DealRepository } from '../ports/deal.repository';

/**
 * Executa as regras. Cada disparo (regra + `dedupeKey`) é registrado ANTES
 * de agir: se o mesmo disparo chegar de novo (evento repetido, sweep
 * repetido, retry), não roda outra vez — uma mensagem ao cliente nunca sai
 * duplicada. O preço: se o processo cair no meio, o disparo fica "running" e
 * não é refeito (preferimos não enviar a enviar duas vezes).
 *
 * Uma ação que falha (canal desconectado, equipe excluída) não impede as
 * seguintes; o resultado de cada uma fica na execução. Ação de conversa num
 * negócio sem conversa é pulada (com o motivo).
 */
@Injectable()
export class AutomationRunner {
  private readonly logger = new Logger(AutomationRunner.name);

  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY) private readonly runs: AutomationRunRepository,
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    @Inject(CONVERSATION_ACTIONS) private readonly conversations: ConversationActions,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /** Ações da regra (gatilhos de entrada e de tempo parado). */
  run(rule: AutomationRule, deal: Deal, dedupeKey: string): Promise<void> {
    return this.once(rule, deal, dedupeKey, async () => {
      const results: ActionResult[] = [];
      for (const action of rule.actions) {
        results.push(await this.attempt(action.type, () => this.execute(action, rule, deal)));
      }
      return results;
    });
  }

  /** Gatilhos de evento da conversa: leva o negócio para a etapa da regra. */
  moveInto(rule: AutomationRule, deal: Deal, dedupeKey: string): Promise<void> {
    return this.once(rule, deal, dedupeKey, async () => [
      await this.attempt('move', () => this.moveToTop(deal.id, rule.columnId)),
    ]);
  }

  private async once(
    rule: AutomationRule,
    deal: Deal,
    dedupeKey: string,
    work: () => Promise<ActionResult[]>,
  ): Promise<void> {
    const runId = this.ids.generate();
    const started = await this.runs.start({
      id: runId,
      tenantId: rule.tenantId,
      ruleId: rule.id,
      dealId: deal.id,
      conversationId: deal.conversationId,
      dedupeKey,
      status: 'running',
      results: [],
      createdAt: new Date(),
      finishedAt: null,
    });
    if (!started) return;

    const results = await work();
    const ok = results.every((r) => r.ok);
    await this.runs.finish(runId, ok ? 'succeeded' : 'failed', results);
    if (!ok) {
      this.logger.warn(`Automação ${rule.id} no negócio ${deal.id}: ${JSON.stringify(results)}`);
    }
  }

  private async attempt(type: string, action: () => Promise<void | string>) {
    try {
      const skipped = await action();
      return skipped ? { type, ok: true, error: skipped } : { type, ok: true };
    } catch (error) {
      return { type, ok: false, error: error instanceof DomainError ? error.code : 'UNEXPECTED' };
    }
  }

  /** Devolve um motivo quando a ação foi pulada (sem erro). */
  private async execute(
    action: AutomationAction,
    rule: AutomationRule,
    deal: Deal,
  ): Promise<void | string> {
    switch (action.type) {
      case 'send_message': {
        if (!deal.conversationId) return 'DEAL_WITHOUT_CONVERSATION';
        const name = await this.conversations.contactName(deal.conversationId);
        const text = renderTemplate(action.text, { name });
        await this.conversations.sendAutomatedMessage(deal.conversationId, text);
        return;
      }
      case 'assign': {
        // A pessoa vira responsável pelo negócio E pela conversa (se houver).
        const { teamId, assigneeId } = action;
        if (assigneeId !== undefined) await this.setOwner(deal.id, assigneeId);
        if (!deal.conversationId)
          return teamId !== undefined ? 'DEAL_WITHOUT_CONVERSATION' : undefined;
        await this.conversations.assign(deal.conversationId, { teamId, assigneeId });
        return;
      }
      case 'move': {
        // Alguém moveu o negócio nesse meio tempo: a regra de "parado" não vale mais.
        const current = await this.deals.findById(deal.id);
        if (!current || current.columnId !== rule.columnId) return 'DEAL_ALREADY_MOVED';
        return this.moveToTop(deal.id, action.columnId);
      }
    }
  }

  private async setOwner(dealId: string, ownerId: string | null): Promise<void> {
    await this.unitOfWork.run(async () => {
      const deal = await this.deals.findById(dealId);
      if (!deal) return;
      deal.setOwner(ownerId);
      await this.deals.save(deal);
      await this.events.publish(deal.pullEvents());
    });
  }

  /** Topo da etapa de destino, "movido pelo sistema" (dispara as regras de entrada dela). */
  private async moveToTop(dealId: string, columnId: string): Promise<void | string> {
    return this.unitOfWork.run(async () => {
      const deal = await this.deals.findById(dealId);
      if (!deal) return 'DEAL_REMOVED';
      if (!deal.isOpen) return 'DEAL_CLOSED';
      if (deal.columnId === columnId) return 'ALREADY_IN_COLUMN';
      const first = await this.deals.first(columnId, deal.id);
      deal.moveTo(columnId, positionBetween(null, first?.position ?? null)!, null);
      await this.deals.save(deal);
      await this.events.publish(deal.pullEvents());
    });
  }
}
