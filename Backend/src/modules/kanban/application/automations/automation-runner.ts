import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { AutomationAction, AutomationRule } from '../../domain/automation-rule.entity';
import type { BoardCard } from '../../domain/board-card.entity';
import { positionBetween } from '../../domain/card-position';
import { renderTemplate } from '../../../../shared/domain/message-template';
import { BOARD_CARD_REPOSITORY, type BoardCardRepository } from '../ports/board-card.repository';
import {
  AUTOMATION_RUN_REPOSITORY,
  type ActionResult,
  type AutomationRunRepository,
} from '../ports/automation-run.repository';
import { CONVERSATION_ACTIONS, type ConversationActions } from '../ports/conversation-actions';

/**
 * Executa as regras. Cada disparo (regra + `dedupeKey`) é registrado ANTES
 * de agir: se o mesmo disparo chegar de novo (evento repetido, sweep
 * repetido, retry), não roda outra vez — uma mensagem ao cliente nunca sai
 * duplicada. O preço: se o processo cair no meio, o disparo fica "running" e
 * não é refeito (preferimos não enviar a enviar duas vezes).
 *
 * Uma ação que falha (canal desconectado, equipe excluída) não impede as
 * seguintes; o resultado de cada uma fica na execução.
 */
@Injectable()
export class AutomationRunner {
  private readonly logger = new Logger(AutomationRunner.name);

  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY) private readonly runs: AutomationRunRepository,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(CONVERSATION_ACTIONS) private readonly conversations: ConversationActions,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /** Ações da regra (gatilhos de entrada e de tempo parado). */
  run(rule: AutomationRule, card: BoardCard, dedupeKey: string): Promise<void> {
    return this.once(rule, card, dedupeKey, async () => {
      const results: ActionResult[] = [];
      for (const action of rule.actions) {
        results.push(await this.attempt(action.type, () => this.execute(action, rule, card)));
      }
      return results;
    });
  }

  /** Gatilhos de evento da conversa: leva o card para a coluna da regra. */
  moveInto(rule: AutomationRule, card: BoardCard, dedupeKey: string): Promise<void> {
    return this.once(rule, card, dedupeKey, async () => [
      await this.attempt('move', () => this.moveToTop(card.id, rule.columnId)),
    ]);
  }

  private async once(
    rule: AutomationRule,
    card: BoardCard,
    dedupeKey: string,
    work: () => Promise<ActionResult[]>,
  ): Promise<void> {
    const runId = this.ids.generate();
    const started = await this.runs.start({
      id: runId,
      tenantId: rule.tenantId,
      ruleId: rule.id,
      cardId: card.id,
      conversationId: card.conversationId,
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
      this.logger.warn(`Automação ${rule.id} no card ${card.id}: ${JSON.stringify(results)}`);
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
    card: BoardCard,
  ): Promise<void | string> {
    switch (action.type) {
      case 'send_message': {
        const name = await this.conversations.contactName(card.conversationId);
        const text = renderTemplate(action.text, { name });
        await this.conversations.sendAutomatedMessage(card.conversationId, text);
        return;
      }
      case 'assign': {
        const { teamId, assigneeId } = action;
        await this.conversations.assign(card.conversationId, { teamId, assigneeId });
        return;
      }
      case 'move': {
        // Alguém moveu o card nesse meio tempo: a regra de "parado" não vale mais.
        const current = await this.cards.findById(card.id);
        if (!current || current.columnId !== rule.columnId) return 'CARD_ALREADY_MOVED';
        return this.moveToTop(card.id, action.columnId);
      }
    }
  }

  /** Topo da coluna de destino, "movido pelo sistema" (dispara as regras de entrada dela). */
  private async moveToTop(cardId: string, columnId: string): Promise<void | string> {
    return this.unitOfWork.run(async () => {
      const card = await this.cards.findById(cardId);
      if (!card) return 'CARD_REMOVED';
      if (card.columnId === columnId) return 'ALREADY_IN_COLUMN';
      const first = await this.cards.first(columnId, card.id);
      card.moveTo(columnId, positionBetween(null, first?.position ?? null)!, null);
      await this.cards.save(card);
      await this.events.publish(card.pullEvents());
    });
  }
}
