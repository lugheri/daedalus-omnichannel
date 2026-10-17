import { DomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Eventos públicos do módulo kanban (exportados no index.ts). O tempo real
 * os repassa às telas; as automações das etapas reagem à entrada de negócios.
 */

/**
 * Negócio entrou numa etapa: foi aberto no funil (`previousColumnId` null) ou
 * movido de outra etapa. Gatilho das automações "ao entrar na etapa".
 */
export class DealEnteredColumnEvent extends DomainEvent {
  static readonly eventName = 'kanban.deal.entered-column.v1';
  readonly eventName = DealEnteredColumnEvent.eventName;

  constructor(
    dealId: string,
    readonly tenantId: string,
    readonly boardId: string,
    readonly contactId: string,
    readonly conversationId: string | null,
    readonly columnId: string,
    readonly previousColumnId: string | null,
    /** Quem moveu (membership); null = o sistema (entrada automática, automação). */
    readonly movedBy: string | null,
  ) {
    super(dealId);
  }
}

/**
 * Negócio mudou de um jeito que as telas precisam ver: posição na mesma
 * etapa, título, valor, responsável, conversa, reaberto ou removido.
 */
export class DealChangedEvent extends DomainEvent {
  static readonly eventName = 'kanban.deal.changed.v1';
  readonly eventName = DealChangedEvent.eventName;

  constructor(
    dealId: string,
    readonly tenantId: string,
    readonly boardId: string,
    readonly contactId: string,
    readonly removed: boolean,
  ) {
    super(dealId);
  }
}

/** Negócio ganho ou perdido (sai do funil; base dos relatórios de vendas). */
export class DealClosedEvent extends DomainEvent {
  static readonly eventName = 'kanban.deal.closed.v1';
  readonly eventName = DealClosedEvent.eventName;

  constructor(
    dealId: string,
    readonly tenantId: string,
    readonly boardId: string,
    readonly contactId: string,
    readonly status: 'won' | 'lost',
    readonly valueCents: number | null,
    /** Quem fechou (membership); null = o sistema. */
    readonly closedBy: string | null,
  ) {
    super(dealId);
  }
}

/** Funil criado, renomeado, com etapas alteradas ou excluído. */
export class BoardChangedEvent extends DomainEvent {
  static readonly eventName = 'kanban.board.changed.v1';
  readonly eventName = BoardChangedEvent.eventName;

  constructor(
    boardId: string,
    readonly tenantId: string,
    readonly deleted: boolean,
  ) {
    super(boardId);
  }
}
