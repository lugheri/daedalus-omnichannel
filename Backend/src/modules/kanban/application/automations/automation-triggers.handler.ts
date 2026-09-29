import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import {
  ConversationDispositionSetEvent,
  ConversationMessageAddedEvent,
  ConversationStatusChangedEvent,
} from '../../../conversations';
import type { TriggerType } from '../../domain/automation-rule.entity';
import { BoardCardEnteredColumnEvent } from '../../domain/events/kanban-events';
import { BOARD_CARD_REPOSITORY, type BoardCardRepository } from '../ports/board-card.repository';
import { BOARD_REPOSITORY, type BoardRepository } from '../ports/board.repository';
import {
  AUTOMATION_RULE_REPOSITORY,
  type AutomationRuleRepository,
} from '../ports/automation-rule.repository';
import { AutomationRunner } from './automation-runner';

/**
 * Gatilhos por evento (no worker, no tenant do evento). O id da entrega do
 * evento é a chave do disparo: evento repetido não roda a regra de novo.
 */
@Injectable()
export class KanbanAutomationTriggersHandler {
  constructor(
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    private readonly runner: AutomationRunner,
  ) {}

  /** Card entrou numa coluna: ações das regras "ao entrar" dela. */
  @HandlesDomainEvent(BoardCardEnteredColumnEvent)
  async onCardEntered(event: DeliveredEvent<BoardCardEnteredColumnEvent>): Promise<void> {
    const rules = await this.rules.listEnabledForColumn(event.columnId, 'card_entered');
    if (rules.length === 0) return;
    const card = await this.cards.findById(event.aggregateId);
    if (!card) return;
    for (const rule of rules) await this.runner.run(rule, card, event.eventId);
  }

  @HandlesDomainEvent(ConversationDispositionSetEvent)
  onDisposition(event: DeliveredEvent<ConversationDispositionSetEvent>) {
    return this.moveCards(event, 'disposition_set', event.dispositionId);
  }

  @HandlesDomainEvent(ConversationStatusChangedEvent)
  onStatus(event: DeliveredEvent<ConversationStatusChangedEvent>) {
    if (event.status !== 'resolved') return Promise.resolve();
    return this.moveCards(event, 'conversation_resolved');
  }

  @HandlesDomainEvent(ConversationMessageAddedEvent)
  onMessage(event: DeliveredEvent<ConversationMessageAddedEvent>) {
    if (event.direction !== 'inbound') return Promise.resolve();
    return this.moveCards(event, 'customer_replied');
  }

  /**
   * Em cada quadro em que a conversa está, leva o card para a coluna da regra
   * que casa com o evento. Mais de uma regra no mesmo quadro: vale a da coluna
   * mais à esquerda (resultado previsível).
   */
  private async moveCards(
    event: { aggregateId: string; eventId: string },
    trigger: TriggerType,
    dispositionId?: string,
  ): Promise<void> {
    const cards = await this.cards.listByConversation(event.aggregateId);
    for (const card of cards) {
      const rules = await this.rules.listEnabledMoveInto(card.boardId, trigger, dispositionId);
      if (rules.length === 0) continue;
      const board = await this.boards.findById(card.boardId);
      if (!board) continue;
      const order = board.columns.map((c) => c.id);
      const [rule] = rules.sort((a, b) => order.indexOf(a.columnId) - order.indexOf(b.columnId));
      if (card.columnId === rule.columnId) continue;
      await this.runner.moveInto(rule, card, event.eventId);
    }
  }
}
