import { Test, type TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { AppConfigModule } from '../../src/config/app-config.module';
import { BoardCard } from '../../src/modules/kanban/domain/board-card.entity';
import { Board } from '../../src/modules/kanban/domain/board.entity';
import { PrismaBoardCardRepository } from '../../src/modules/kanban/infra/prisma-board-card.repository';
import { PrismaBoardRepository } from '../../src/modules/kanban/infra/prisma-board.repository';
import type { AppClsStore } from '../../src/shared/infra/context/app-cls-store';
import { PrismaModule } from '../../src/shared/infra/prisma/prisma.module';
import { PrismaService } from '../../src/shared/infra/prisma/prisma.service';
import { SharedInfraModule } from '../../src/shared/infra/shared-infra.module';

/**
 * Repositórios do kanban contra o Postgres real: o que só o banco garante
 * (SQL de renumerar/mover em massa, isolamento por tenant, cascata ao apagar
 * o quadro com as FKs escolhidas).
 */
describe('Kanban (Postgres real)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let boards: PrismaBoardRepository;
  let cards: PrismaBoardCardRepository;
  const tenantId = randomUUID();
  const otherTenant = randomUUID();

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, SharedInfraModule],
      providers: [PrismaBoardRepository, PrismaBoardCardRepository],
    }).compile();
    await app.init();
    prisma = app.get(PrismaService);
    boards = app.get(PrismaBoardRepository);
    cards = app.get(PrismaBoardCardRepository);
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
    const placed: BoardCard[] = [];
    for (const position of positions) {
      const card = BoardCard.place(
        randomUUID(),
        {
          tenantId: tenant,
          boardId: board.id,
          columnId: a.id,
          conversationId: randomUUID(),
          position,
        },
        null,
      );
      await cards.save(card);
      placed.push(card);
    }
    return { board, placed };
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
      const existing = BoardCard.place(
        randomUUID(),
        { tenantId, boardId: board.id, columnId: b.id, conversationId: randomUUID(), position: 7 },
        null,
      );
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
      expect(await prisma.boardCard.count({ where: { boardId: board.id } })).toBe(0);
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
});
