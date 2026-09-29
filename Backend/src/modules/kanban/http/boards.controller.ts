import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequireAnyPermission, RequirePermissions } from '../../accounts';
import {
  AddColumnUseCase,
  BoardsReader,
  CreateBoardUseCase,
  DeleteBoardUseCase,
  DeleteColumnUseCase,
  UpdateBoardUseCase,
  UpdateColumnUseCase,
} from '../application/use-cases/boards.use-cases';
import {
  AddCardUseCase,
  ListBoardCardsUseCase,
  ListConversationPlacementsUseCase,
  MoveCardUseCase,
  RemoveCardUseCase,
} from '../application/use-cases/cards.use-cases';
import {
  addCardSchema,
  columnNameSchema,
  createBoardSchema,
  deleteColumnQuerySchema,
  listCardsQuerySchema,
  moveCardSchema,
  placementsQuerySchema,
  updateBoardSchema,
  updateColumnSchema,
  type AddCardDto,
  type ColumnNameDto,
  type CreateBoardDto,
  type DeleteColumnQuery,
  type ListCardsQuery,
  type MoveCardDto,
  type PlacementsQuery,
  type UpdateBoardDto,
  type UpdateColumnDto,
} from './dto/kanban.dto';
import { BoardPresenter, CardPresenter } from './kanban.presenter';

const idParam = new ZodValidationPipe(z.uuid());

/**
 * Quadros kanban. Ver e mover cards: qualquer escopo de conversas (os cards
 * são filtrados pelas conversas que o membro vê). Estrutura do quadro:
 * `boards:manage`.
 */
@RequireAnyPermission('conversations:view:own', 'conversations:view:team', 'conversations:view:all')
@Controller('v1/boards')
export class BoardsController {
  constructor(
    private readonly reader: BoardsReader,
    private readonly createBoard: CreateBoardUseCase,
    private readonly updateBoard: UpdateBoardUseCase,
    private readonly deleteBoard: DeleteBoardUseCase,
    private readonly addColumn: AddColumnUseCase,
    private readonly updateColumn: UpdateColumnUseCase,
    private readonly deleteColumn: DeleteColumnUseCase,
    private readonly listCards: ListBoardCardsUseCase,
    private readonly addCard: AddCardUseCase,
    private readonly moveCard: MoveCardUseCase,
    private readonly removeCard: RemoveCardUseCase,
    private readonly placements: ListConversationPlacementsUseCase,
  ) {}

  @Get()
  async list() {
    return (await this.reader.list()).map(BoardPresenter.toHttp);
  }

  /** Em que quadros (e colunas) está uma conversa. */
  @Get('placements')
  async conversationPlacements(
    @Query(new ZodValidationPipe(placementsQuerySchema)) query: PlacementsQuery,
  ) {
    return (await this.placements.execute(query.conversationId)).map(CardPresenter.placement);
  }

  @Get(':id')
  async get(@Param('id', idParam) id: string) {
    return BoardPresenter.toHttp(await this.reader.get(id));
  }

  @RequirePermissions('boards:manage')
  @Post()
  async create(@Body(new ZodValidationPipe(createBoardSchema)) body: CreateBoardDto) {
    return BoardPresenter.toHttp(await this.createBoard.execute(body));
  }

  /** Renomear e/ou configurar a entrada automática. */
  @RequirePermissions('boards:manage')
  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateBoardSchema)) body: UpdateBoardDto,
  ) {
    return BoardPresenter.toHttp(await this.updateBoard.execute(id, body));
  }

  @RequirePermissions('boards:manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deleteBoard.execute(id);
  }

  @RequirePermissions('boards:manage')
  @Post(':id/columns')
  async createColumn(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(columnNameSchema)) body: ColumnNameDto,
  ) {
    return BoardPresenter.toHttp(await this.addColumn.execute(id, body.name));
  }

  @RequirePermissions('boards:manage')
  @Patch(':id/columns/:columnId')
  async changeColumn(
    @Param('id', idParam) id: string,
    @Param('columnId', idParam) columnId: string,
    @Body(new ZodValidationPipe(updateColumnSchema)) body: UpdateColumnDto,
  ) {
    return BoardPresenter.toHttp(await this.updateColumn.execute(id, columnId, body));
  }

  /** Coluna com cards: `?moveTo=<outra coluna>` leva os cards para o fim dela. */
  @RequirePermissions('boards:manage')
  @Delete(':id/columns/:columnId')
  async removeColumn(
    @Param('id', idParam) id: string,
    @Param('columnId', idParam) columnId: string,
    @Query(new ZodValidationPipe(deleteColumnQuerySchema)) query: DeleteColumnQuery,
  ) {
    return BoardPresenter.toHttp(await this.deleteColumn.execute(id, columnId, query.moveTo));
  }

  @Get(':id/cards')
  async cards(
    @Param('id', idParam) id: string,
    @Query(new ZodValidationPipe(listCardsQuerySchema)) query: ListCardsQuery,
  ) {
    return (await this.listCards.execute(id, query)).map(CardPresenter.page);
  }

  @Post(':id/cards')
  async createCard(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(addCardSchema)) body: AddCardDto,
  ) {
    return CardPresenter.toHttp(await this.addCard.execute({ boardId: id, ...body }));
  }

  @Post(':id/cards/:cardId/move')
  async move(
    @Param('id', idParam) id: string,
    @Param('cardId', idParam) cardId: string,
    @Body(new ZodValidationPipe(moveCardSchema)) body: MoveCardDto,
  ) {
    return CardPresenter.toHttp(await this.moveCard.execute({ boardId: id, cardId, ...body }));
  }

  @Delete(':id/cards/:cardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCard(@Param('id', idParam) id: string, @Param('cardId', idParam) cardId: string) {
    await this.removeCard.execute({ boardId: id, cardId });
  }
}
