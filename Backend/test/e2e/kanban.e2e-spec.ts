import { Test, type TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { AppConfigModule } from '../../src/config/app-config.module';
import { idleDedupeKey } from '../../src/modules/kanban/application/ports/automation-run.repository';
import { AutomationRule } from '../../src/modules/kanban/domain/automation-rule.entity';
import { Board } from '../../src/modules/kanban/domain/board.entity';
import { Deal } from '../../src/modules/kanban/domain/deal.entity';
import { PrismaBoardRepository } from '../../src/modules/kanban/infra/prisma-board.repository';
import { PrismaDealRepository } from '../../src/modules/kanban/infra/prisma-deal.repository';
import {
  PrismaAutomationRuleRepository,
  PrismaAutomationRunRepository,
} from '../../src/modules/kanban/infra/prisma-automation.repository';
import type { AppClsStore } from '../../src/shared/infra/context/app-cls-store';
import { PrismaModule } from '../../src/shared/infra/prisma/prisma.module';
import { PrismaService } from '../../src/shared/infra/prisma/prisma.service';
import { SharedInfraModule } from '../../src/shared/infra/shared-infra.module';

/**
 * Repositórios dos funis contra o Postgres real: o que só o banco garante
 * (SQL de renumerar/mover em massa, isolamento por tenant, cascata ao apagar
 * o funil com as FKs escolhidas, negócios fechados fora da etapa).
 */
describe('Kanban (Postgres real)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let boards: PrismaBoardRepository;
  let cards: PrismaDealRepository;
  let rules: PrismaAutomationRuleRepository;
  let runs: PrismaAutomationRunRepository;
  const tenantId = randomUUID();
  const otherTenant = randomUUID();

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, SharedInfraModule],
      providers: [
        PrismaBoardRepository,
        PrismaDealRepository,
        PrismaAutomationRuleRepository,
        PrismaAutomationRunRepository,
      ],
    }).compile();
    await app.init();
    prisma = app.get(PrismaService);
    boards = app.get(PrismaBoardRepository);
    cards = app.get(PrismaDealRepository);
    rules = app.get(PrismaAutomationRuleRepository);
    runs = app.get(PrismaAutomationRunRepository);
  });

  afterAll(async () => {
    await prisma.board.deleteMany({ where: { tenantId: { in: [tenantId, otherTenant] } } });
    await app.close();
  });

  function inTenant<T>(tenant: string, work: () => Promise<T>): Promise<T> {
    const cls = app.get<ClsService<AppClsStore>>(ClsService);
    return cls.run(() => {
      cls.set('tenantId', tenant);
      return work();
    });
  }

  async function boardWithCards(tenant: string, positions: number[]) {
    const board = Board.create(randomUUID(), {
      tenantId: tenant,
      name: `Quadro ${randomUUID().slice(0, 8)}`,
      columns: [
        { id: randomUUID(), name: 'A' },
        { id: randomUUID(), name: 'B' },
      ],
    });
    await boards.save(board);
    const [a] = board.columns;
    const placed: Deal[] = [];
    for (const position of positions) {
      const card = deal({ tenant, boardId: board.id, columnId: a.id, position });
      await cards.save(card);
      placed.push(card);
    }
    return { board, placed };
  }

  function deal(input: {
    tenant: string;
    boardId: string;
    columnId: string;
    position: number;
    contactId?: string;
  }): Deal {
    return Deal.open(
      randomUUID(),
      {
        tenantId: input.tenant,
        boardId: input.boardId,
        columnId: input.columnId,
        contactId: input.contactId ?? randomUUID(),
        conversationId: randomUUID(),
        title: 'Negócio',
        position: input.position,
      },
      null,
    );
  }

  const order = async (columnId: string) =>
    (await cards.listColumn(columnId, { limit: 50 })).map((c) => [c.id, c.position]);

  it('renumbers a column keeping the order, only in the current tenant', async () => {
    await inTenant(tenantId, async () => {
      const { board, placed } = await boardWithCards(tenantId, [5, 0, 1e-9]);
      const [a] = board.columns;
      await cards.renumber(a.id);
      expect(await order(a.id)).toEqual([
        [placed[1].id, 0],
        [placed[2].id, 1],
        [placed[0].id, 2],
      ]);

      // Outro tenant não enxerga nem mexe na coluna.
      await inTenant(otherTenant, async () => {
        await cards.renumber(a.id);
        expect(await cards.listColumn(a.id, { limit: 50 })).toEqual([]);
      });
    });
  });

  it('moves every card to the end of another column, in order', async () => {
    await inTenant(tenantId, async () => {
      const { board, placed } = await boardWithCards(tenantId, [0, 1, 2]);
      const [a, b] = board.columns;
      const existing = deal({ tenant: tenantId, boardId: board.id, columnId: b.id, position: 7 });
      await cards.save(existing);

      await cards.moveAll(a.id, b.id);

      expect(await cards.countInColumn(a.id)).toBe(0);
      expect(await order(b.id)).toEqual([
        [existing.id, 7],
        [placed[0].id, 8],
        [placed[1].id, 9],
        [placed[2].id, 10],
      ]);
    });
  });

  it('deleting a board takes its columns and cards; a column with cards cannot go alone', async () => {
    await inTenant(tenantId, async () => {
      const { board } = await boardWithCards(tenantId, [0]);
      // A coluna com card não sai sozinha (FK NoAction).
      await expect(
        prisma.boardColumn.delete({ where: { id: board.columns[0].id } }),
      ).rejects.toThrow();

      await boards.delete(board);
      expect(await prisma.deal.count({ where: { boardId: board.id } })).toBe(0);
      expect(await prisma.boardColumn.count({ where: { boardId: board.id } })).toBe(0);
    });
  });

  it('saves column changes (renamed, reordered, removed)', async () => {
    await inTenant(tenantId, async () => {
      const { board } = await boardWithCards(tenantId, []);
      const [a, b] = board.columns;
      board.addColumn(randomUUID(), 'C');
      board.renameColumn(b.id, 'Bê');
      board.moveColumn(b.id, 0);
      board.removeColumn(a.id);
      await boards.save(board);

      const saved = await boards.findById(board.id);
      expect(saved?.columns.map((c) => c.name)).toEqual(['Bê', 'C']);
    });
  });

  it('idle automation: due cards count from activation, and each entry runs once', async () => {
    await inTenant(tenantId, async () => {
      const { board, placed } = await boardWithCards(tenantId, [0, 1]);
      const [a, b] = board.columns;
      const rule = AutomationRule.create(randomUUID(), {
        tenantId,
        boardId: board.id,
        columnId: a.id,
        trigger: { type: 'card_idle', minutes: 60 },
        actions: [{ type: 'move', columnId: b.id }],
      });
      await rules.save(rule);
      expect((await rules.findById(rule.id))?.trigger).toEqual({ type: 'card_idle', minutes: 60 });
      expect((await rules.listEnabledIdleAllTenants()).map((r) => r.id)).toContain(rule.id);

      const at = (min: number) => new Date(rule.activeSince.getTime() + min * 60_000);
      // Cards acabaram de entrar e a regra é nova: nada antes de 60 min.
      expect(await runs.dueIdleDeals(rule, at(59), 10)).toEqual([]);
      const due = await runs.dueIdleDeals(rule, at(61), 10);
      expect(due.map((c) => c.id).sort()).toEqual(placed.map((c) => c.id).sort());

      const run = {
        id: randomUUID(),
        tenantId,
        ruleId: rule.id,
        dealId: due[0].id,
        conversationId: due[0].conversationId,
        dedupeKey: idleDedupeKey(due[0]),
        status: 'running' as const,
        results: [],
        createdAt: new Date(),
        finishedAt: null,
      };
      expect(await runs.start(run)).toBe(true);
      expect(await runs.start({ ...run, id: randomUUID() })).toBe(false); // mesmo disparo
      await runs.finish(run.id, 'succeeded', [{ type: 'move', ok: true }]);

      // A chave do SQL bate com a do código: o card que rodou sai da lista.
      expect((await runs.dueIdleDeals(rule, at(61), 10)).map((c) => c.id)).toEqual([due[1].id]);
      expect((await runs.listByRule(rule.id, 5))[0]).toMatchObject({
        status: 'succeeded',
        results: [{ type: 'move', ok: true }],
      });
    });
  });

  it('closed deals leave the stage listing and the idle sweep, but still live in the stage', async () => {
    await inTenant(tenantId, async () => {
      const contactId = randomUUID();
      const { board, placed } = await boardWithCards(tenantId, [0, 1]);
      const [a, b] = board.columns;
      const won = deal({
        tenant: tenantId,
        boardId: board.id,
        columnId: a.id,
        position: 2,
        contactId,
      });
      won.win(null);
      await cards.save(won);
      const open = deal({
        tenant: tenantId,
        boardId: board.id,
        columnId: a.id,
        position: 3,
        contactId,
      });
      await cards.save(open);

      expect((await cards.listColumn(a.id, { limit: 50 })).map((d) => d.id)).toEqual([
        placed[0].id,
        placed[1].id,
        open.id,
      ]);
      expect(await cards.countInColumn(a.id)).toBe(4);
      expect((await cards.findOpenOnBoard(board.id, contactId))?.id).toBe(open.id);
      expect((await cards.listByContact(contactId)).map((d) => [d.id, d.status])).toEqual(
        expect.arrayContaining([
          [won.id, 'won'],
          [open.id, 'open'],
        ]),
      );
      const saved = await cards.findById(won.id);
      expect(saved).toMatchObject({ status: 'won', title: 'Negócio' });
      expect(saved?.closedAt).toBeInstanceOf(Date);

      const rule = AutomationRule.create(randomUUID(), {
        tenantId,
        boardId: board.id,
        columnId: a.id,
        trigger: { type: 'card_idle', minutes: 1 },
        actions: [{ type: 'move', columnId: b.id }],
      });
      await rules.save(rule);
      const due = await runs.dueIdleDeals(rule, new Date(Date.now() + 10 * 60_000), 10);
      expect(due.map((d) => d.id)).not.toContain(won.id);

      // Excluir a etapa leva também os fechados (senão a FK barraria).
      await cards.moveAll(a.id, b.id);
      expect(await cards.countInColumn(a.id)).toBe(0);
      expect((await cards.findById(won.id))?.columnId).toBe(b.id);
    });
  });
});
