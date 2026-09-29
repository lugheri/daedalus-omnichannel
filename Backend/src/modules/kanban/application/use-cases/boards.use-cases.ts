import { Inject, Injectable } from '@nestjs/common';
import type { EventBus } from '../../../../shared/application/event-bus';
import { EVENT_BUS } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { Board, type AutoAdd } from '../../domain/board.entity';
import { BoardNameTakenError } from '../../domain/errors/board-name-taken.error';
import { BoardNotFoundError } from '../../domain/errors/board-not-found.error';
import { ColumnNotEmptyError } from '../../domain/errors/column-not-empty.error';
import { InvalidBoardTeamError } from '../../domain/errors/invalid-board-team.error';
import { BOARD_CARD_REPOSITORY, type BoardCardRepository } from '../ports/board-card.repository';
import { BOARD_REPOSITORY, type BoardRepository } from '../ports/board.repository';
import {
  AUTOMATION_RULE_REPOSITORY,
  type AutomationRuleRepository,
} from '../ports/automation-rule.repository';
import { TEAM_DIRECTORY, type TeamDirectory } from '../ports/team-directory';

/** Colunas de um quadro novo, se quem cria não disser outras. */
export const DEFAULT_COLUMNS = ['Novos', 'Em atendimento', 'Concluídos'];

/**
 * Quadros e colunas. Ver é aberto a quem tem escopo de conversas; criar e
 * mudar exige `boards:manage` (checado na rota).
 */
@Injectable()
export class BoardsReader {
  constructor(@Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository) {}

  list(): Promise<Board[]> {
    return this.boards.list();
  }

  async get(id: string): Promise<Board> {
    const board = await this.boards.findById(id);
    if (!board) throw new BoardNotFoundError();
    return board;
  }
}

/** Base dos use cases que alteram um quadro: carrega, altera, salva e avisa. */
abstract class BoardChange {
  constructor(
    protected readonly boards: BoardRepository,
    private readonly events: EventBus,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  protected async change(boardId: string, apply: (board: Board) => Promise<void> | void) {
    const board = await this.boards.findById(boardId);
    if (!board) throw new BoardNotFoundError();
    await this.unitOfWork.run(async () => {
      await apply(board);
      await this.boards.save(board);
      await this.events.publish(board.pullEvents());
    });
    return board;
  }

  protected async assertNameFree(name: string, selfId?: string) {
    const existing = await this.boards.findByName(name);
    if (existing && existing.id !== selfId) throw new BoardNameTakenError();
  }
}

@Injectable()
export class CreateBoardUseCase {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { name: string; columns?: string[] }): Promise<Board> {
    const board = Board.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      name: input.name,
      columns: (input.columns ?? DEFAULT_COLUMNS).map((name) => ({
        id: this.ids.generate(),
        name,
      })),
    });
    if (await this.boards.findByName(board.name)) throw new BoardNameTakenError();
    await this.unitOfWork.run(async () => {
      await this.boards.save(board);
      await this.events.publish(board.pullEvents());
    });
    return board;
  }
}

@Injectable()
export class UpdateBoardUseCase extends BoardChange {
  constructor(
    @Inject(BOARD_REPOSITORY) boards: BoardRepository,
    @Inject(EVENT_BUS) events: EventBus,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
  ) {
    super(boards, events, unitOfWork);
  }

  /** Campo ausente = não muda. */
  execute(id: string, input: { name?: string; autoAdd?: AutoAdd }): Promise<Board> {
    return this.change(id, async (board) => {
      if (input.name !== undefined) {
        board.rename(input.name);
        await this.assertNameFree(board.name, board.id);
      }
      if (input.autoAdd) {
        if (input.autoAdd.mode === 'team' && !(await this.teams.exists(input.autoAdd.teamId))) {
          throw new InvalidBoardTeamError();
        }
        board.setAutoAdd(input.autoAdd);
      }
    });
  }
}

@Injectable()
export class DeleteBoardUseCase {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /** Leva colunas e cards junto (as conversas não são afetadas). */
  async execute(id: string): Promise<void> {
    const board = await this.boards.findById(id);
    if (!board) throw new BoardNotFoundError();
    board.markDeleted();
    await this.unitOfWork.run(async () => {
      await this.boards.delete(board);
      await this.events.publish(board.pullEvents());
    });
  }
}

@Injectable()
export class AddColumnUseCase extends BoardChange {
  constructor(
    @Inject(BOARD_REPOSITORY) boards: BoardRepository,
    @Inject(EVENT_BUS) events: EventBus,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {
    super(boards, events, unitOfWork);
  }

  execute(boardId: string, name: string): Promise<Board> {
    return this.change(boardId, (board) => void board.addColumn(this.ids.generate(), name));
  }
}

@Injectable()
export class UpdateColumnUseCase extends BoardChange {
  constructor(
    @Inject(BOARD_REPOSITORY) boards: BoardRepository,
    @Inject(EVENT_BUS) events: EventBus,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
  ) {
    super(boards, events, unitOfWork);
  }

  /** Renomear e/ou mudar de lugar (`index`: 0 = primeira coluna). */
  execute(
    boardId: string,
    columnId: string,
    input: { name?: string; index?: number },
  ): Promise<Board> {
    return this.change(boardId, (board) => {
      if (input.name !== undefined) board.renameColumn(columnId, input.name);
      if (input.index !== undefined) board.moveColumn(columnId, input.index);
      board.column(columnId); // coluna de outro quadro: 404 mesmo sem mudança
    });
  }
}

@Injectable()
export class DeleteColumnUseCase extends BoardChange {
  constructor(
    @Inject(BOARD_REPOSITORY) boards: BoardRepository,
    @Inject(EVENT_BUS) events: EventBus,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(BOARD_CARD_REPOSITORY) private readonly cards: BoardCardRepository,
    @Inject(AUTOMATION_RULE_REPOSITORY) private readonly rules: AutomationRuleRepository,
  ) {
    super(boards, events, unitOfWork);
  }

  /**
   * Coluna com cards precisa de `moveTo` (outra coluna do quadro): eles vão
   * para o fim dela, sem disparar as automações de entrada. As automações da
   * coluna e as que movem cards PARA ela saem junto.
   */
  execute(boardId: string, columnId: string, moveTo?: string): Promise<Board> {
    return this.change(boardId, async (board) => {
      board.column(columnId);
      if (moveTo !== undefined) board.column(moveTo);
      board.removeColumn(columnId);
      if ((await this.cards.countInColumn(columnId)) > 0) {
        if (moveTo === undefined || moveTo === columnId) throw new ColumnNotEmptyError();
        await this.cards.moveAll(columnId, moveTo);
      }
      for (const rule of await this.rules.listByBoard(board.id)) {
        if (rule.dependsOnColumn(columnId)) await this.rules.delete(rule);
      }
    });
  }
}
