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
import { DealEnteredColumnEvent } from '../../domain/events/kanban-events';
import { BOARD_REPOSITORY, type BoardRepository } from '../ports/board.repository';
import { DEAL_REPOSITORY, type DealRepository } from '../ports/deal.repository';
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
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    private readonly runner: AutomationRunner,
  ) {}

  /** Negócio entrou numa etapa: ações das regras "ao entrar" dela. */
  @HandlesDomainEvent(DealEnteredColumnEvent)
  async onDealEntered(event: DeliveredEvent<DealEnteredColumnEvent>): Promise<void> {
    const rules = await this.rules.listEnabledForColumn(event.columnId, 'card_entered');
    if (rules.length === 0) return;
    const deal = await this.deals.findById(event.aggregateId);
    if (!deal?.isOpen) return;
    for (const rule of rules) await this.runner.run(rule, deal, event.eventId);
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
   * Cada negócio em aberto da conversa vai para a etapa da regra que casa com
   * o evento. Mais de uma regra no mesmo funil: vale a da etapa mais à
   * esquerda (resultado previsível).
   */
  private async moveCards(
    event: { aggregateId: string; eventId: string },
    trigger: TriggerType,
    dispositionId?: string,
  ): Promise<void> {
    const deals = await this.deals.listOpenByConversation(event.aggregateId);
    for (const deal of deals) {
      const rules = await this.rules.listEnabledMoveInto(deal.boardId, trigger, dispositionId);
      if (rules.length === 0) continue;
      const board = await this.boards.findById(deal.boardId);
      if (!board) continue;
      const order = board.columns.map((c) => c.id);
      const [rule] = rules.sort((a, b) => order.indexOf(a.columnId) - order.indexOf(b.columnId));
      if (deal.columnId === rule.columnId) continue;
      await this.runner.moveInto(rule, deal, event.eventId);
    }
  }
}
