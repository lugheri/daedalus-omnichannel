import type { TenantContext } from '../../../shared/application/tenant-context';
import type { BoardCardRepository, CardKey } from '../application/ports/board-card.repository';
import type { BoardRepository } from '../application/ports/board.repository';
import type { AutomationRuleRepository } from '../application/ports/automation-rule.repository';
import {
  idleDedupeKey,
  type ActionResult,
  type AutomationRun,
  type AutomationRunRepository,
  type RunStatus,
} from '../application/ports/automation-run.repository';
import type { ConversationActions } from '../application/ports/conversation-actions';
import type { MemberDirectory } from '../application/ports/member-directory';
import { AutomationRule, type TriggerType } from '../domain/automation-rule.entity';
import type {
  CardConversation,
  ConversationDirectory,
} from '../application/ports/conversation-directory';
import type { TeamDirectory } from '../application/ports/team-directory';
import { BoardCard } from '../domain/board-card.entity';
import { Board } from '../domain/board.entity';

/** Cópia do agregado: salvar e carregar não compartilham a instância (como no banco). */
const copyBoard = (b: Board) =>
  Board.restore(b.id, {
    tenantId: b.tenantId,
    name: b.name,
    columns: b.columns.map((c) => ({ ...c })),
    autoAdd: { ...b.autoAdd },
    createdAt: b.createdAt,
  });

export class InMemoryBoardRepository implements BoardRepository {
  private items: Board[] = [];

  constructor(
    private readonly tenant: TenantContext,
    /** Apagar o quadro leva os cards (como o CASCADE). */
    private readonly cards?: InMemoryBoardCardRepository,
  ) {}

  private ofTenant() {
    return this.items.filter((b) => b.tenantId === this.tenant.tenantId);
  }

  save(board: Board): Promise<void> {
    this.items = [...this.items.filter((b) => b.id !== board.id), copyBoard(board)];
    return Promise.resolve();
  }

  findById(id: string): Promise<Board | null> {
    const board = this.ofTenant().find((b) => b.id === id);
    return Promise.resolve(board ? copyBoard(board) : null);
  }

  findByName(name: string): Promise<Board | null> {
    const board = this.ofTenant().find((b) => b.name.toLowerCase() === name.toLowerCase());
    return Promise.resolve(board ? copyBoard(board) : null);
  }

  list(): Promise<Board[]> {
    return Promise.resolve(
      this.ofTenant()
        .map(copyBoard)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  delete(board: Board): Promise<void> {
    this.items = this.items.filter((b) => b.id !== board.id);
    this.cards?.removeBoard(board.id);
    return Promise.resolve();
  }

  listAcceptingNewConversations(teamId: string | null): Promise<Board[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((b) => b.acceptsNewConversation(teamId))
        .map(copyBoard),
    );
  }

  clearAutoAddTeam(teamId: string): Promise<void> {
    for (const b of this.ofTenant()) {
      if (b.autoAdd.mode === 'team' && b.autoAdd.teamId === teamId) b.setAutoAdd({ mode: 'none' });
    }
    return Promise.resolve();
  }
}

const copyCard = (c: BoardCard) =>
  BoardCard.restore(c.id, {
    tenantId: c.tenantId,
    boardId: c.boardId,
    columnId: c.columnId,
    conversationId: c.conversationId,
    position: c.position,
    enteredColumnAt: c.enteredColumnAt,
    createdAt: c.createdAt,
  });

const byKey = (a: CardKey, b: CardKey) => a.position - b.position || a.id.localeCompare(b.id);
const isAfter = (c: CardKey, key: CardKey) => byKey(c, key) > 0;

export class InMemoryBoardCardRepository implements BoardCardRepository {
  items: BoardCard[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((c) => c.tenantId === this.tenant.tenantId);
  }

  private column(columnId: string) {
    return this.ofTenant()
      .filter((c) => c.columnId === columnId)
      .sort(byKey);
  }

  removeBoard(boardId: string) {
    this.items = this.items.filter((c) => c.boardId !== boardId);
  }

  save(card: BoardCard): Promise<void> {
    this.items = [...this.items.filter((c) => c.id !== card.id), copyCard(card)];
    return Promise.resolve();
  }

  delete(card: BoardCard): Promise<void> {
    this.items = this.items.filter((c) => c.id !== card.id);
    return Promise.resolve();
  }

  findById(id: string): Promise<BoardCard | null> {
    const card = this.ofTenant().find((c) => c.id === id);
    return Promise.resolve(card ? copyCard(card) : null);
  }

  findOnBoard(boardId: string, conversationId: string): Promise<BoardCard | null> {
    const card = this.ofTenant().find(
      (c) => c.boardId === boardId && c.conversationId === conversationId,
    );
    return Promise.resolve(card ? copyCard(card) : null);
  }

  listByConversation(conversationId: string): Promise<BoardCard[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((c) => c.conversationId === conversationId)
        .map(copyCard),
    );
  }

  listColumn(columnId: string, { after, limit }: { after?: CardKey; limit: number }) {
    return Promise.resolve(
      this.column(columnId)
        .filter((c) => !after || isAfter(c, after))
        .slice(0, limit)
        .map(copyCard),
    );
  }

  first(columnId: string, excludeId?: string): Promise<BoardCard | null> {
    const card = this.column(columnId).find((c) => c.id !== excludeId);
    return Promise.resolve(card ? copyCard(card) : null);
  }

  last(columnId: string): Promise<BoardCard | null> {
    const card = this.column(columnId).at(-1);
    return Promise.resolve(card ? copyCard(card) : null);
  }

  next(columnId: string, key: CardKey, excludeId?: string): Promise<BoardCard | null> {
    const card = this.column(columnId).find((c) => c.id !== excludeId && isAfter(c, key));
    return Promise.resolve(card ? copyCard(card) : null);
  }

  countInColumn(columnId: string): Promise<number> {
    return Promise.resolve(this.column(columnId).length);
  }

  renumber(columnId: string): Promise<void> {
    this.column(columnId).forEach((c, index) => this.reposition(c, columnId, index));
    return Promise.resolve();
  }

  async moveAll(fromColumnId: string, toColumnId: string): Promise<void> {
    const start = ((await this.last(toColumnId))?.position ?? -1) + 1;
    this.column(fromColumnId).forEach((c, index) => this.reposition(c, toColumnId, start + index));
  }

  /** Grava sem eventos (as operações em massa não disparam automações). */
  private reposition(card: BoardCard, columnId: string, position: number) {
    const moved = BoardCard.restore(card.id, {
      tenantId: card.tenantId,
      boardId: card.boardId,
      columnId,
      conversationId: card.conversationId,
      position,
      enteredColumnAt: columnId === card.columnId ? card.enteredColumnAt : new Date(),
      createdAt: card.createdAt,
    });
    this.items = [...this.items.filter((c) => c.id !== card.id), moved];
  }
}

/** Conversas que existem e as que o membro atual vê. */
export class FakeConversationDirectory implements ConversationDirectory {
  readonly hidden = new Set<string>();

  visible(ids: string[]): Promise<CardConversation[]> {
    return Promise.resolve(ids.filter((id) => !this.hidden.has(id)).map(conversation));
  }

  isVisible(id: string): Promise<boolean> {
    return Promise.resolve(!this.hidden.has(id));
  }
}

export function conversation(id: string): CardConversation {
  return {
    id,
    status: 'open',
    assigneeId: null,
    dispositionId: null,
    unreadCount: 0,
    lastMessageAt: new Date('2030-01-01T10:00:00Z'),
    lastMessagePreview: 'Oi',
    contact: { id: `contact-${id}`, name: `Cliente ${id}`, phone: null },
    channel: { id: 'ch-1', name: 'Comercial' },
    team: null,
  };
}

export class FakeTeamDirectory implements TeamDirectory {
  constructor(private readonly teams: string[] = []) {}

  exists(teamId: string): Promise<boolean> {
    return Promise.resolve(this.teams.includes(teamId));
  }
}

const copyRule = (r: AutomationRule) =>
  AutomationRule.restore(r.id, {
    tenantId: r.tenantId,
    boardId: r.boardId,
    columnId: r.columnId,
    trigger: { ...r.trigger },
    actions: r.actions.map((a) => ({ ...a })),
    enabled: r.enabled,
    activeSince: r.activeSince,
    createdAt: r.createdAt,
  });

export class InMemoryAutomationRuleRepository implements AutomationRuleRepository {
  items: AutomationRule[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((r) => r.tenantId === this.tenant.tenantId);
  }

  save(rule: AutomationRule): Promise<void> {
    const index = this.items.findIndex((r) => r.id === rule.id);
    if (index >= 0) this.items[index] = copyRule(rule);
    else this.items.push(copyRule(rule));
    return Promise.resolve();
  }

  findById(id: string): Promise<AutomationRule | null> {
    const rule = this.ofTenant().find((r) => r.id === id);
    return Promise.resolve(rule ? copyRule(rule) : null);
  }

  listByBoard(boardId: string): Promise<AutomationRule[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((r) => r.boardId === boardId)
        .map(copyRule),
    );
  }

  listEnabledForColumn(columnId: string, trigger: TriggerType): Promise<AutomationRule[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((r) => r.enabled && r.columnId === columnId && r.trigger.type === trigger)
        .map(copyRule),
    );
  }

  listEnabledMoveInto(boardId: string, trigger: TriggerType, dispositionId?: string) {
    return Promise.resolve(
      this.ofTenant()
        .filter((r) => r.enabled && r.boardId === boardId && r.trigger.type === trigger)
        .filter(
          (r) =>
            !dispositionId ||
            (r.trigger.type === 'disposition_set' && r.trigger.dispositionId === dispositionId),
        )
        .map(copyRule),
    );
  }

  countForColumn(columnId: string): Promise<number> {
    return Promise.resolve(this.ofTenant().filter((r) => r.columnId === columnId).length);
  }

  delete(rule: AutomationRule): Promise<void> {
    this.items = this.items.filter((r) => r.id !== rule.id);
    return Promise.resolve();
  }

  listEnabledIdleAllTenants(): Promise<{ id: string; tenantId: string }[]> {
    return Promise.resolve(
      this.items
        .filter((r) => r.enabled && r.trigger.type === 'card_idle')
        .map((r) => ({ id: r.id, tenantId: r.tenantId })),
    );
  }
}

/** Execuções; "vencidos" reproduz a consulta do banco sobre os cards informados. */
export class InMemoryAutomationRunRepository implements AutomationRunRepository {
  items: AutomationRun[] = [];

  constructor(
    private readonly tenant: TenantContext,
    private readonly cards: InMemoryBoardCardRepository,
  ) {}

  start(run: AutomationRun): Promise<boolean> {
    if (this.items.some((r) => r.ruleId === run.ruleId && r.dedupeKey === run.dedupeKey)) {
      return Promise.resolve(false);
    }
    this.items.push({ ...run });
    return Promise.resolve(true);
  }

  finish(runId: string, status: RunStatus, results: ActionResult[]): Promise<void> {
    const run = this.items.find((r) => r.id === runId)!;
    Object.assign(run, { status, results, finishedAt: new Date() });
    return Promise.resolve();
  }

  listByRule(ruleId: string, limit: number): Promise<AutomationRun[]> {
    return Promise.resolve(
      this.items
        .filter((r) => r.ruleId === ruleId && r.tenantId === this.tenant.tenantId)
        .reverse()
        .slice(0, limit),
    );
  }

  async dueIdleCards(rule: AutomationRule, now: Date, limit: number): Promise<BoardCard[]> {
    if (rule.trigger.type !== 'card_idle') return [];
    const before = now.getTime() - rule.trigger.minutes * 60_000;
    const inColumn = await this.cards.listColumn(rule.columnId, { limit: 10_000 });
    return inColumn
      .filter((c) => Math.max(c.enteredColumnAt.getTime(), rule.activeSince.getTime()) <= before)
      .filter(
        (c) => !this.items.some((r) => r.ruleId === rule.id && r.dedupeKey === idleDedupeKey(c)),
      )
      .slice(0, limit);
  }
}

/** Registra o que as automações fizeram; `failSend` simula o canal fora. */
export class FakeConversationActions implements ConversationActions {
  readonly sent: { conversationId: string; text: string }[] = [];
  readonly assigned: {
    conversationId: string;
    teamId?: string | null;
    assigneeId?: string | null;
  }[] = [];
  readonly names = new Map<string, string | null>();
  readonly dispositions = new Set<string>();
  failSend: Error | null = null;

  contactName(conversationId: string): Promise<string | null> {
    return Promise.resolve(this.names.get(conversationId) ?? null);
  }

  sendAutomatedMessage(conversationId: string, text: string): Promise<void> {
    if (this.failSend) return Promise.reject(this.failSend);
    this.sent.push({ conversationId, text });
    return Promise.resolve();
  }

  assign(
    conversationId: string,
    input: { teamId?: string | null; assigneeId?: string | null },
  ): Promise<void> {
    this.assigned.push({ conversationId, ...input });
    return Promise.resolve();
  }

  dispositionExists(dispositionId: string): Promise<boolean> {
    return Promise.resolve(this.dispositions.has(dispositionId));
  }
}

export class FakeMemberDirectory implements MemberDirectory {
  constructor(private readonly active: string[] = []) {}

  isActive(membershipId: string): Promise<boolean> {
    return Promise.resolve(this.active.includes(membershipId));
  }
}
