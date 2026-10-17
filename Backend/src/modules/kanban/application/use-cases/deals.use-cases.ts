import { Inject, Injectable } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../../shared/application/actor-context';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import type { Board, BoardColumn } from '../../domain/board.entity';
import { positionBetween } from '../../domain/card-position';
import { Deal } from '../../domain/deal.entity';
import { BoardConversationNotFoundError } from '../../domain/errors/board-conversation-not-found.error';
import { DealNotFoundError } from '../../domain/errors/deal-not-found.error';
import { InvalidDealError } from '../../domain/errors/invalid-deal.error';
import {
  CONTACT_DIRECTORY,
  defaultDealTitle,
  type ContactDirectory,
  type DealContact,
} from '../ports/contact-directory';
import {
  CONVERSATION_DIRECTORY,
  type CardConversation,
  type ConversationDirectory,
} from '../ports/conversation-directory';
import { DEAL_ACCESS, type DealAccess } from '../ports/deal-access';
import { DEAL_REPOSITORY, type DealKey, type DealRepository } from '../ports/deal.repository';
import { MEMBER_DIRECTORY, type MemberDirectory } from '../ports/member-directory';
import { BoardsReader } from './boards.use-cases';

/** Um negócio como a tela o mostra. */
export interface DealView {
  deal: Deal;
  contact: DealContact | null;
  /** Só se o membro vê a conversa (senão o negócio aparece sem ela). */
  conversation: CardConversation | null;
}

export interface ColumnPage {
  columnId: string;
  deals: DealView[];
  /** Opaco; null = acabou. */
  nextCursor: string | null;
}

/** Quantas vezes buscar mais negócios quando muitos são de fora do que o membro vê. */
const MAX_ROUNDS = 5;

/**
 * Quem vê qual negócio (ver `DealAccess`): supervisão vê todos; o atendente
 * vê os seus, os sem responsável (a fila de leads) e os das conversas que ele
 * vê. A conversa só acompanha o negócio se o membro a vê.
 */
@Injectable()
export class DealVisibility {
  constructor(
    @Inject(DEAL_ACCESS) private readonly access: DealAccess,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
  ) {}

  /** Dos negócios informados, os que o membro vê, com contato e conversa (na mesma ordem). */
  async views(deals: Deal[]): Promise<DealView[]> {
    if (deals.length === 0) return [];
    const viewer = await this.access.current();
    const conversationIds = [
      ...new Set(deals.flatMap((d) => (d.conversationId ? [d.conversationId] : []))),
    ];
    const visible = new Map(
      (await this.conversations.visible(conversationIds)).map((c) => [c.id, c]),
    );
    const shown = deals.filter(
      (deal) =>
        viewer.seesAll ||
        deal.ownerId === null ||
        deal.ownerId === viewer.membershipId ||
        (deal.conversationId !== null && visible.has(deal.conversationId)),
    );
    const contacts = new Map(
      (await this.contacts.findByIds([...new Set(shown.map((d) => d.contactId))])).map((c) => [
        c.id,
        c,
      ]),
    );
    return shown.map((deal) => ({
      deal,
      contact: contacts.get(deal.contactId) ?? null,
      conversation: (deal.conversationId && visible.get(deal.conversationId)) || null,
    }));
  }

  /** O negócio, se o membro o vê (senão 404). */
  async load(deals: DealRepository, dealId: string): Promise<DealView> {
    const deal = await deals.findById(dealId);
    const [view] = deal ? await this.views([deal]) : [];
    if (!view) throw new DealNotFoundError();
    return view;
  }
}

/**
 * Negócios EM ABERTO do funil, etapa a etapa, só os que o membro vê. Uma
 * etapa específica (`columnId`) serve o "carregar mais" dela.
 */
@Injectable()
export class ListBoardDealsUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
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
    start: DealKey | undefined,
    limit: number,
  ): Promise<ColumnPage> {
    const views: DealView[] = [];
    let after = start;
    let hasMore = true;
    // O cursor aponta para o último negócio PERCORRIDO (visível ou não).
    for (let round = 0; round < MAX_ROUNDS && hasMore && views.length < limit; round++) {
      const batch = await this.deals.listColumn(column.id, { after, limit });
      if (batch.length < limit) hasMore = false;
      const visible = new Map((await this.visibility.views(batch)).map((v) => [v.deal.id, v]));
      for (const [index, deal] of batch.entries()) {
        after = keyOf(deal);
        const view = visible.get(deal.id);
        if (view) views.push(view);
        if (views.length === limit) {
          // Parou no meio do lote: com certeza há mais.
          if (index < batch.length - 1) hasMore = true;
          break;
        }
      }
    }
    return {
      columnId: column.id,
      deals: views,
      nextCursor: hasMore && after ? encodeCursor(after) : null,
    };
  }
}

export interface CreateDealInput {
  boardId: string;
  /** Ausente = primeira etapa. */
  columnId?: string;
  /** O contato do negócio — ou a conversa, de onde ele vem. */
  contactId?: string;
  conversationId?: string;
  /** Ausente = nome do contato. */
  title?: string;
  valueCents?: number | null;
  /** Ausente = quem cria; null = ninguém (fila de leads). */
  ownerId?: string | null;
}

/** Abre um negócio no topo da etapa (padrão: a primeira). */
@Injectable()
export class CreateDealUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
    @Inject(MEMBER_DIRECTORY) private readonly members: MemberDirectory,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: CreateDealInput): Promise<Deal> {
    const board = await this.boards.get(input.boardId);
    const column = input.columnId ? board.column(input.columnId) : board.firstColumn;

    let contactId = input.contactId;
    if (input.conversationId) {
      const [conversation] = await this.conversations.visible([input.conversationId]);
      if (!conversation) throw new BoardConversationNotFoundError();
      // A conversa é de outro contato: pedido incoerente.
      if (contactId && contactId !== conversation.contact.id) {
        throw new DealNotFoundError('DEAL_CONTACT_NOT_FOUND');
      }
      contactId = conversation.contact.id;
    }
    const contact = contactId ? await this.contacts.findById(contactId) : null;
    if (!contact) throw new DealNotFoundError('DEAL_CONTACT_NOT_FOUND');

    const me = this.actors.actor.membershipId;
    const ownerId = input.ownerId === undefined ? me : input.ownerId;
    if (ownerId && ownerId !== me && !(await this.members.isActive(ownerId))) {
      throw new InvalidDealError('DEAL_INVALID_OWNER');
    }

    return this.unitOfWork.run(async () => {
      const deal = await openOnTop(this.deals, this.ids, {
        tenantId: this.tenant.tenantId,
        board,
        columnId: column.id,
        contactId: contact.id,
        conversationId: input.conversationId ?? null,
        title: input.title ?? defaultDealTitle(contact),
        valueCents: input.valueCents ?? null,
        ownerId,
        by: me,
      });
      await this.events.publish(deal.pullEvents());
      return deal;
    });
  }
}

export interface DealDetail extends DealView {
  board: Board;
  column: BoardColumn;
}

@Injectable()
export class GetDealUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
  ) {}

  async execute(dealId: string): Promise<DealDetail> {
    const view = await this.visibility.load(this.deals, dealId);
    const board = await this.boards.get(view.deal.boardId);
    return { ...view, board, column: board.column(view.deal.columnId) };
  }
}

/** Título, valor, responsável e/ou conversa. Campo ausente = não muda. */
@Injectable()
export class UpdateDealUseCase {
  constructor(
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
    @Inject(MEMBER_DIRECTORY) private readonly members: MemberDirectory,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    dealId: string,
    input: {
      title?: string;
      valueCents?: number | null;
      ownerId?: string | null;
      conversationId?: string;
    },
  ): Promise<Deal> {
    const { deal } = await this.visibility.load(this.deals, dealId);
    if (input.ownerId && !(await this.members.isActive(input.ownerId))) {
      throw new InvalidDealError('DEAL_INVALID_OWNER');
    }
    if (input.conversationId) {
      const [conversation] = await this.conversations.visible([input.conversationId]);
      if (!conversation || conversation.contact.id !== deal.contactId) {
        throw new BoardConversationNotFoundError();
      }
    }

    deal.edit({ title: input.title, valueCents: input.valueCents });
    if (input.ownerId !== undefined) deal.setOwner(input.ownerId);
    if (input.conversationId) deal.linkConversation(input.conversationId);
    await this.unitOfWork.run(async () => {
      await this.deals.save(deal);
      await this.events.publish(deal.pullEvents());
    });
    return deal;
  }
}

/**
 * Move um negócio em aberto: para outra etapa e/ou outra posição.
 * `afterDealId` é o negócio que fica logo acima dele no destino (null = topo).
 */
@Injectable()
export class MoveDealUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: {
    dealId: string;
    columnId: string;
    afterDealId: string | null;
  }): Promise<Deal> {
    const { deal } = await this.visibility.load(this.deals, input.dealId);
    const board = await this.boards.get(deal.boardId);
    board.column(input.columnId);
    if (!deal.isOpen) throw new InvalidDealError('DEAL_NOT_OPEN');

    let above: Deal | null = null;
    if (input.afterDealId) {
      above = await this.deals.findById(input.afterDealId);
      // O vizinho precisa estar em aberto na etapa de destino (e não ser o próprio).
      if (!above || !above.isOpen || above.columnId !== input.columnId || above.id === deal.id) {
        throw new DealNotFoundError();
      }
    }

    return this.unitOfWork.run(async () => {
      let position = await this.slot(input.columnId, above, deal.id);
      if (position === null) {
        await this.deals.renumber(input.columnId);
        if (above) above = await this.deals.findById(above.id);
        position = (await this.slot(input.columnId, above, deal.id))!;
      }
      deal.moveTo(input.columnId, position, this.actors.actor.membershipId);
      await this.deals.save(deal);
      await this.events.publish(deal.pullEvents());
      return deal;
    });
  }

  private async slot(columnId: string, above: Deal | null, selfId: string) {
    const below = above
      ? await this.deals.next(columnId, keyOf(above), selfId)
      : await this.deals.first(columnId, selfId);
    return positionBetween(above?.position ?? null, below?.position ?? null);
  }
}

/** Ganho, perdido (com motivo opcional) ou reaberto. */
@Injectable()
export class SetDealStatusUseCase {
  constructor(
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    dealId: string,
    input: { status: 'won' | 'lost' | 'open'; lostReason?: string | null },
  ): Promise<Deal> {
    const { deal } = await this.visibility.load(this.deals, dealId);
    const me = this.actors.actor.membershipId;
    if (input.status === 'won') deal.win(me);
    else if (input.status === 'lost') deal.lose(input.lostReason ?? null, me);
    else deal.reopen();
    await this.unitOfWork.run(async () => {
      await this.deals.save(deal);
      await this.events.publish(deal.pullEvents());
    });
    return deal;
  }
}

/** Exclui o negócio (o contato e a conversa não são afetados). */
@Injectable()
export class DeleteDealUseCase {
  constructor(
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(dealId: string): Promise<void> {
    const { deal } = await this.visibility.load(this.deals, dealId);
    deal.markRemoved();
    await this.unitOfWork.run(async () => {
      await this.deals.delete(deal);
      await this.events.publish(deal.pullEvents());
    });
  }
}

export interface DealPlacement extends DealView {
  board: Board;
  column: BoardColumn;
}

/** Junta funil e etapa (negócio de funil já excluído não aparece). */
async function placed(boards: BoardsReader, views: DealView[]): Promise<DealPlacement[]> {
  const byId = new Map((await boards.list()).map((b) => [b.id, b]));
  return views.flatMap((view) => {
    const board = byId.get(view.deal.boardId);
    const column = board?.columns.find((c) => c.id === view.deal.columnId);
    return board && column ? [{ ...view, board, column }] : [];
  });
}

/** Negócios de um contato (ficha): abertos primeiro, depois os fechados. */
@Injectable()
export class ListContactDealsUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
  ) {}

  async execute(contactId: string): Promise<DealPlacement[]> {
    const views = await this.visibility.views(await this.deals.listByContact(contactId));
    const rows = await placed(this.boards, views);
    return rows.sort((a, b) => Number(!a.deal.isOpen) - Number(!b.deal.isOpen));
  }
}

/** Negócios em aberto de uma conversa (cabeçalho do chat). */
@Injectable()
export class ListConversationDealsUseCase {
  constructor(
    private readonly boards: BoardsReader,
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    private readonly visibility: DealVisibility,
    @Inject(CONVERSATION_DIRECTORY) private readonly conversations: ConversationDirectory,
  ) {}

  async execute(conversationId: string): Promise<DealPlacement[]> {
    if (!(await this.conversations.isVisible(conversationId))) {
      throw new BoardConversationNotFoundError();
    }
    const deals = await this.deals.listOpenByConversation(conversationId);
    return placed(this.boards, await this.visibility.views(deals));
  }
}

/** Abre no topo de uma etapa e grava (usado também pela entrada automática). */
export async function openOnTop(
  deals: DealRepository,
  ids: IdGenerator,
  input: {
    tenantId: string;
    board: Board;
    columnId: string;
    contactId: string;
    conversationId: string | null;
    title: string;
    valueCents?: number | null;
    ownerId: string | null;
    by: string | null;
  },
): Promise<Deal> {
  const first = await deals.first(input.columnId);
  const deal = Deal.open(
    ids.generate(),
    {
      tenantId: input.tenantId,
      boardId: input.board.id,
      columnId: input.columnId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      title: input.title,
      valueCents: input.valueCents ?? null,
      ownerId: input.ownerId,
      position: positionBetween(null, first?.position ?? null)!,
    },
    input.by,
  );
  await deals.save(deal);
  return deal;
}

function keyOf(deal: Deal): DealKey {
  return { position: deal.position, id: deal.id };
}

function encodeCursor(key: DealKey): string {
  return Buffer.from(`${key.position}|${key.id}`).toString('base64url');
}

/** Cursor inválido = do começo. */
function decodeCursor(cursor: string | undefined): DealKey | undefined {
  if (!cursor) return undefined;
  const [raw, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const position = Number(raw);
  return Number.isFinite(position) && id ? { position, id } : undefined;
}
