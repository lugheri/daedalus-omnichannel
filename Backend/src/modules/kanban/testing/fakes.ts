import type { TenantContext } from '../../../shared/application/tenant-context';
import type { BoardRepository } from '../application/ports/board.repository';
import type { ContactDirectory, DealContact } from '../application/ports/contact-directory';
import type { DealAccess, DealViewer } from '../application/ports/deal-access';
import type { DealKey, DealRepository } from '../application/ports/deal.repository';
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
import { Board } from '../domain/board.entity';
import { Deal } from '../domain/deal.entity';

/** Cópia do agregado: salvar e carregar não compartilham a instância (como no banco). */
const copyBoard = (b: Board) =>
  Board.restore(b.id, {
    tenantId: b.tenantId,
    name: b.name,
    columns: b.columns.map((c) => ({ ...c })),
    autoAdd: { ...b.autoAdd },
    autoAddLeads: b.autoAddLeads,
    createdAt: b.createdAt,
  });

export class InMemoryBoardRepository implements BoardRepository {
  private items: Board[] = [];

  constructor(
    private readonly tenant: TenantContext,
    /** Apagar o funil leva os negócios (como o CASCADE). */
    private readonly deals?: InMemoryDealRepository,
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
    this.deals?.removeBoard(board.id);
    return Promise.resolve();
  }

  count(): Promise<number> {
    return Promise.resolve(this.ofTenant().length);
  }

  listAcceptingLeads(): Promise<Board[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((b) => b.autoAddLeads)
        .map(copyBoard),
    );
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

const copyDeal = (d: Deal, changes: Partial<{ columnId: string; position: number }> = {}) =>
  Deal.restore(d.id, {
    tenantId: d.tenantId,
    boardId: d.boardId,
    columnId: changes.columnId ?? d.columnId,
    contactId: d.contactId,
    conversationId: d.conversationId,
    title: d.title,
    valueCents: d.valueCents,
    ownerId: d.ownerId,
    status: d.status,
    lostReason: d.lostReason,
    closedAt: d.closedAt,
    position: changes.position ?? d.position,
    enteredColumnAt:
      changes.columnId && changes.columnId !== d.columnId ? new Date() : d.enteredColumnAt,
    createdAt: d.createdAt,
  });

const byKey = (a: DealKey, b: DealKey) => a.position - b.position || a.id.localeCompare(b.id);
const isAfter = (d: DealKey, key: DealKey) => byKey(d, key) > 0;

/** Reproduz o repositório real: isolado por tenant; a etapa só lista os em aberto. */
export class InMemoryDealRepository implements DealRepository {
  items: Deal[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((d) => d.tenantId === this.tenant.tenantId);
  }

  private openIn(columnId: string) {
    return this.inColumn(columnId).filter((d) => d.isOpen);
  }

  /** Todos da etapa, inclusive fechados. */
  private inColumn(columnId: string) {
    return this.ofTenant()
      .filter((d) => d.columnId === columnId)
      .sort(byKey);
  }

  private replace(deal: Deal) {
    this.items = [...this.items.filter((d) => d.id !== deal.id), deal];
  }

  removeBoard(boardId: string) {
    this.items = this.items.filter((d) => d.boardId !== boardId);
  }

  save(deal: Deal): Promise<void> {
    this.replace(copyDeal(deal));
    return Promise.resolve();
  }

  delete(deal: Deal): Promise<void> {
    this.items = this.items.filter((d) => d.id !== deal.id);
    return Promise.resolve();
  }

  findById(id: string): Promise<Deal | null> {
    const deal = this.ofTenant().find((d) => d.id === id);
    return Promise.resolve(deal ? copyDeal(deal) : null);
  }

  findOpenOnBoard(boardId: string, contactId: string): Promise<Deal | null> {
    const deal = this.ofTenant()
      .filter((d) => d.boardId === boardId && d.contactId === contactId && d.isOpen)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return Promise.resolve(deal ? copyDeal(deal) : null);
  }

  listOpenByConversation(conversationId: string): Promise<Deal[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((d) => d.conversationId === conversationId && d.isOpen)
        .map((d) => copyDeal(d)),
    );
  }

  listByContact(contactId: string): Promise<Deal[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((d) => d.contactId === contactId)
        .reverse()
        .map((d) => copyDeal(d)),
    );
  }

  listColumn(columnId: string, { after, limit }: { after?: DealKey; limit: number }) {
    return Promise.resolve(
      this.openIn(columnId)
        .filter((d) => !after || isAfter(d, after))
        .slice(0, limit)
        .map((d) => copyDeal(d)),
    );
  }

  first(columnId: string, excludeId?: string): Promise<Deal | null> {
    const deal = this.openIn(columnId).find((d) => d.id !== excludeId);
    return Promise.resolve(deal ? copyDeal(deal) : null);
  }

  last(columnId: string): Promise<Deal | null> {
    const deal = this.inColumn(columnId).at(-1);
    return Promise.resolve(deal ? copyDeal(deal) : null);
  }

  next(columnId: string, key: DealKey, excludeId?: string): Promise<Deal | null> {
    const deal = this.openIn(columnId).find((d) => d.id !== excludeId && isAfter(d, key));
    return Promise.resolve(deal ? copyDeal(deal) : null);
  }

  countInColumn(columnId: string): Promise<number> {
    return Promise.resolve(this.inColumn(columnId).length);
  }

  renumber(columnId: string): Promise<void> {
    this.inColumn(columnId).forEach((d, index) => this.replace(copyDeal(d, { position: index })));
    return Promise.resolve();
  }

  async moveAll(fromColumnId: string, toColumnId: string): Promise<void> {
    const start = ((await this.last(toColumnId))?.position ?? -1) + 1;
    // Sem eventos: as operações em massa não disparam automações.
    this.inColumn(fromColumnId).forEach((d, index) =>
      this.replace(copyDeal(d, { columnId: toColumnId, position: start + index })),
    );
  }
}

/** Contatos que existem (por id). */
export class FakeContactDirectory implements ContactDirectory {
  readonly contacts = new Map<string, DealContact>();

  add(id: string, name: string | null = `Cliente ${id}`): DealContact {
    const contact = { id, name, phone: '+5511999990000', email: null };
    this.contacts.set(id, contact);
    return contact;
  }

  findById(id: string): Promise<DealContact | null> {
    return Promise.resolve(this.contacts.get(id) ?? null);
  }

  findByIds(ids: string[]): Promise<DealContact[]> {
    return Promise.resolve(ids.flatMap((id) => this.contacts.get(id) ?? []));
  }
}

/** O membro da requisição; `seesAll` = supervisão. */
export class FakeDealAccess implements DealAccess {
  viewer: DealViewer = { membershipId: 'me', seesAll: true };

  current(): Promise<DealViewer> {
    return Promise.resolve(this.viewer);
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
    // A conversa "x" é do contato "contact-x".
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

/** Execuções; "vencidos" reproduz a consulta do banco sobre os negócios em aberto. */
export class InMemoryAutomationRunRepository implements AutomationRunRepository {
  items: AutomationRun[] = [];

  constructor(
    private readonly tenant: TenantContext,
    private readonly deals: InMemoryDealRepository,
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

  async dueIdleDeals(rule: AutomationRule, now: Date, limit: number): Promise<Deal[]> {
    if (rule.trigger.type !== 'card_idle') return [];
    const before = now.getTime() - rule.trigger.minutes * 60_000;
    const inColumn = await this.deals.listColumn(rule.columnId, { limit: 10_000 });
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
