import { Inject, Injectable } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../../shared/application/actor-context';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { BoardCard } from '../../domain/board-card.entity';
import type { Board, BoardColumn } from '../../domain/board.entity';
import { positionBetween } from '../../domain/card-position';
import { BoardConversationNotFoundError } from '../../domain/errors/board-conversation-not-found.error';
import { CardAlreadyOnBoardError } from '../../domain/errors/card-already-on-board.error';
import { CardNotFoundError } from '../../domain/errors/card-not-found.error';
import {
  BOARD_CARD_REPOSITORY,
  type BoardCardRepository,
  type CardKey,
} from '../ports/board-card.repository';
import {
  CONVERSATION_DIRECTORY,
  type CardConversation,
  type ConversationDirectory,
} from '../ports/conversation-directory';
import { BoardsReader } from './boards.use-cases';

export interface CardView {
  card: BoardCard;
  conversation: CardConversation;
}

export interface ColumnPage {
  columnId: string;
  cards: CardView[];
  /** Opaco; null = acabou. */
  nextCursor: string | null;
}

/** Quantas vezes buscar mais cards quando muitos são de conversas que o membro não vê. */
const MAX_ROUNDS = 5;

/**
 * Cards do quadro, coluna a coluna, só das conversas que o membro vê (as
 * mesmas da caixa de entrada). Uma coluna específica (`columnId`) serve o
 * "carregar mais" dela.
 */
@Injectable()
export class ListBoardCardsUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
  ) {}

  async execute(
    boardId: string,
    input: { columnId?: string; cursor?: string; limit: number },
  ): Promise<ColumnPage[]> {
    const board = await this.boards.get(boardId);
    const columns = input.columnId ? [board.column(input.columnId)] : board.columns;
    return Promise.all(
      columns.map((column) =>
        this.page(column, input.columnId ? decodeCursor(input.cursor) : undefined, input.limit),
      ),
    );
  }

  private async page(
    column: BoardColumn,
    start: CardKey | undefined,
    limit: number,
  ): Promise<ColumnPage> {
    const cards: CardView[] = [];
    let after = start;
    let hasMore = true;
    // O cursor aponta para o último card PERCORRIDO (visível ou não).
    for (let round = 0; round < MAX_ROUNDS && hasMore && cards.length < limit; round++) {
      const batch = await this.cards.listColumn(column.id, { after, limit });
      if (batch.length < limit) hasMore = false;
      const visible = new Map(
        (await this.conversations.visible(batch.map((c) => c.conversationId))).map((c) => [
          c.id,
          c,
        ]),
      );
      for (const [index, card] of batch.entries()) {
        after = keyOf(card);
        const conversation = visible.get(card.conversationId);
        if (conversation) cards.push({ card, conversation });
        if (cards.length === limit) {
          // Parou no meio do lote: com certeza há mais.
          if (index < batch.length - 1) hasMore = true;
          break;
        }
      }
    }
    return {
      columnId: column.id,
      cards,
      nextCursor: hasMore && after ? encodeCursor(after) : null,
    };
  }
}

/** Coloca uma conversa no quadro (no topo da coluna; padrão: a primeira). */
@Injectable()
export class AddCardUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: {
    boardId: string;
    conversationId: string;
    columnId?: string;
  }): Promise<BoardCard> {
    const board = await this.boards.get(input.boardId);
    const column = input.columnId ? board.column(input.columnId) : board.firstColumn;
    if (!(await this.conversations.isVisible(input.conversationId))) {
      throw new BoardConversationNotFoundError();
    }
    if (await this.cards.findOnBoard(board.id, input.conversationId)) {
      throw new CardAlreadyOnBoardError();
    }
    return this.unitOfWork.run(async () => {
      const card = await placeOnTop(this.cards, this.ids, {
        tenantId: this.tenant.tenantId,
        board,
        columnId: column.id,
        conversationId: input.conversationId,
        by: this.actors.actor.membershipId,
      });
      await this.events.publish(card.pullEvents());
      return card;
    });
  }
}

/** Card de um quadro, se a conversa dele é visível para o membro. */
async function visibleCard(
  cards: BoardCardRepository,
  conversations: ConversationDirectory,
  boardId: string,
  cardId: string,
): Promise<BoardCard> {
  const card = await cards.findById(cardId);
  if (!card || card.boardId !== boardId || !(await conversations.isVisible(card.conversationId))) {
    throw new CardNotFoundError();
  }
  return card;
}

/**
 * Move um card: para outra coluna e/ou outra posição. `afterCardId` é o card
 * que fica logo acima dele no destino (null = topo da coluna).
 */
@Injectable()
export class MoveCardUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: {
    boardId: string;
    cardId: string;
    columnId: string;
    afterCardId: string | null;
  }): Promise<BoardCard> {
    const board = await this.boards.get(input.boardId);
    board.column(input.columnId);
    const card = await visibleCard(this.cards, this.conversations, board.id, input.cardId);

    let above: BoardCard | null = null;
    if (input.afterCardId) {
      above = await this.cards.findById(input.afterCardId);
      // O vizinho precisa estar na coluna de destino (e não ser o próprio card).
      if (!above || above.columnId !== input.columnId || above.id === card.id) {
        throw new CardNotFoundError();
      }
    }

    return this.unitOfWork.run(async () => {
      let position = await this.slot(input.columnId, above, card.id);
      if (position === null) {
        await this.cards.renumber(input.columnId);
        if (above) above = await this.cards.findById(above.id);
        position = (await this.slot(input.columnId, above, card.id))!;
      }
      card.moveTo(input.columnId, position, this.actors.actor.membershipId);
      await this.cards.save(card);
      await this.events.publish(card.pullEvents());
      return card;
    });
  }

  private async slot(columnId: string, above: BoardCard | null, selfId: string) {
    const below = above
      ? await this.cards.next(columnId, keyOf(above), selfId)
      : await this.cards.first(columnId, selfId);
    return positionBetween(above?.position ?? null, below?.position ?? null);
  }
}

/** Tira do quadro (a conversa não é afetada). */
@Injectable()
export class RemoveCardUseCase {
  constructor(
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: { boardId: string; cardId: string }): Promise<void> {
    const card = await visibleCard(this.cards, this.conversations, input.boardId, input.cardId);
    card.markRemoved();
    await this.unitOfWork.run(async () => {
      await this.cards.delete(card);
      await this.events.publish(card.pullEvents());
    });
  }
}

export interface Placement {
  card: BoardCard;
  board: Board;
  column: BoardColumn;
}

/** Em que quadros (e colunas) uma conversa está — para o cabeçalho do chat. */
@Injectable()
export class ListConversationPlacementsUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
  ) {}

  async execute(conversationId: string): Promise<Placement[]> {
    if (!(await this.conversations.isVisible(conversationId))) {
      throw new BoardConversationNotFoundError();
    }
    const cards = await this.cards.listByConversation(conversationId);
    const boards = new Map((await this.boards.list()).map((b) => [b.id, b]));
    return cards.flatMap((card) => {
      const board = boards.get(card.boardId);
      const column = board?.columns.find((c) => c.id === card.columnId);
      return board && column ? [{ card, board, column }] : [];
    });
  }
}

/** Coloca no topo de uma coluna e grava (usado também pela entrada automática). */
export async function placeOnTop(
  cards: BoardCardRepository,
  ids: IdGenerator,
  input: {
    tenantId: string;
    board: Board;
    columnId: string;
    conversationId: string;
    by: string | null;
  },
): Promise<BoardCard> {
  const first = await cards.first(input.columnId);
  const card = BoardCard.place(
    ids.generate(),
    {
      tenantId: input.tenantId,
      boardId: input.board.id,
      columnId: input.columnId,
      conversationId: input.conversationId,
      position: positionBetween(null, first?.position ?? null)!,
    },
    input.by,
  );
  await cards.save(card);
  return card;
}

function keyOf(card: BoardCard): CardKey {
  return { position: card.position, id: card.id };
}

function encodeCursor(key: CardKey): string {
  return Buffer.from(`${key.position}|${key.id}`).toString('base64url');
}

/** Cursor inválido = do começo. */
function decodeCursor(cursor: string | undefined): CardKey | undefined {
  if (!cursor) return undefined;
  const [raw, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const position = Number(raw);
  return Number.isFinite(position) && id ? { position, id } : undefined;
}
