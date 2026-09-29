import { DomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Eventos públicos do módulo kanban (exportados no index.ts). O tempo real
 * os repassa às telas; as automações das colunas reagem à entrada de cards.
 */

/**
 * Card entrou numa coluna: foi adicionado ao quadro (`previousColumnId` null)
 * ou movido de outra coluna. Gatilho das automações "ao entrar na coluna".
 */
export class BoardCardEnteredColumnEvent extends DomainEvent {
  static readonly eventName = 'kanban.card.entered-column.v1';
  readonly eventName = BoardCardEnteredColumnEvent.eventName;

  constructor(
    cardId: string,
    readonly tenantId: string,
    readonly boardId: string,
    readonly conversationId: string,
    readonly columnId: string,
    readonly previousColumnId: string | null,
    /** Quem moveu (membership); null = o sistema (entrada automática, automação). */
    readonly movedBy: string | null,
  ) {
    super(cardId);
  }
}

/** Card mudou de lugar dentro da mesma coluna (só para as telas). */
export class BoardCardRepositionedEvent extends DomainEvent {
  static readonly eventName = 'kanban.card.repositioned.v1';
  readonly eventName = BoardCardRepositionedEvent.eventName;

  constructor(
    cardId: string,
    readonly tenantId: string,
    readonly boardId: string,
  ) {
    super(cardId);
  }
}

export class BoardCardRemovedEvent extends DomainEvent {
  static readonly eventName = 'kanban.card.removed.v1';
  readonly eventName = BoardCardRemovedEvent.eventName;

  constructor(
    cardId: string,
    readonly tenantId: string,
    readonly boardId: string,
    readonly conversationId: string,
  ) {
    super(cardId);
  }
}

/** Quadro criado, renomeado, com colunas alteradas ou excluído. */
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
