import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  BoardCardEnteredColumnEvent,
  BoardCardRemovedEvent,
  BoardCardRepositionedEvent,
} from './events/kanban-events';

export interface BoardCardProps {
  tenantId: string;
  boardId: string;
  columnId: string;
  conversationId: string;
  /** Ordem na coluna (menor = mais acima); ver `positionBetween`. */
  position: number;
  enteredColumnAt: Date;
  createdAt: Date;
}

/** Uma conversa (atendimento) num quadro. */
export class BoardCard extends AggregateRoot<BoardCardProps> {
  static place(
    id: string,
    input: Omit<BoardCardProps, 'enteredColumnAt' | 'createdAt'>,
    /** Quem colocou (membership); null = o sistema. */
    by: string | null,
  ): BoardCard {
    const now = new Date();
    const card = new BoardCard(id, { ...input, enteredColumnAt: now, createdAt: now });
    card.addEvent(
      new BoardCardEnteredColumnEvent(
        id,
        input.tenantId,
        input.boardId,
        input.conversationId,
        input.columnId,
        null,
        by,
      ),
    );
    return card;
  }

  static restore(id: string, props: BoardCardProps): BoardCard {
    return new BoardCard(id, props);
  }

  /** Outra coluna = entrou nela agora (reinicia o "parado há"). */
  moveTo(columnId: string, position: number, by: string | null): void {
    const previous = this.props.columnId;
    this.props.position = position;
    if (previous === columnId) {
      this.addEvent(
        new BoardCardRepositionedEvent(this.id, this.props.tenantId, this.props.boardId),
      );
      return;
    }
    this.props.columnId = columnId;
    this.props.enteredColumnAt = new Date();
    this.addEvent(
      new BoardCardEnteredColumnEvent(
        this.id,
        this.props.tenantId,
        this.props.boardId,
        this.props.conversationId,
        columnId,
        previous,
        by,
      ),
    );
  }

  markRemoved(): void {
    this.addEvent(
      new BoardCardRemovedEvent(
        this.id,
        this.props.tenantId,
        this.props.boardId,
        this.props.conversationId,
      ),
    );
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get boardId() {
    return this.props.boardId;
  }
  get columnId() {
    return this.props.columnId;
  }
  get conversationId() {
    return this.props.conversationId;
  }
  get position() {
    return this.props.position;
  }
  get enteredColumnAt() {
    return this.props.enteredColumnAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}
