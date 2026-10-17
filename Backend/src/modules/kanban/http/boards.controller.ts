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
import { ListBoardDealsUseCase } from '../application/use-cases/deals.use-cases';
import {
  columnNameSchema,
  createBoardSchema,
  deleteColumnQuerySchema,
  listDealsQuerySchema,
  updateBoardSchema,
  updateColumnSchema,
  type ColumnNameDto,
  type CreateBoardDto,
  type DeleteColumnQuery,
  type ListDealsQuery,
  type UpdateBoardDto,
  type UpdateColumnDto,
} from './dto/kanban.dto';
import { BoardPresenter, DealPresenter } from './kanban.presenter';

const idParam = new ZodValidationPipe(z.uuid());

/**
 * Funis de vendas. Ver: qualquer escopo de conversas (os negócios são
 * filtrados pelo que o membro vê). Estrutura do funil: `boards:manage`.
 * Os negócios em si ficam em `/v1/deals`.
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
    private readonly listDeals: ListBoardDealsUseCase,
  ) {}

  @Get()
  async list() {
    return (await this.reader.list()).map(BoardPresenter.toHttp);
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

  /** Renomear e/ou configurar a entrada automática (conversas e leads). */
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

  /** Etapa com negócios: `?moveTo=<outra etapa>` leva os negócios para o fim dela. */
  @RequirePermissions('boards:manage')
  @Delete(':id/columns/:columnId')
  async removeColumn(
    @Param('id', idParam) id: string,
    @Param('columnId', idParam) columnId: string,
    @Query(new ZodValidationPipe(deleteColumnQuerySchema)) query: DeleteColumnQuery,
  ) {
    return BoardPresenter.toHttp(await this.deleteColumn.execute(id, columnId, query.moveTo));
  }

  /** Negócios em aberto, por etapa. */
  @Get(':id/deals')
  async deals(
    @Param('id', idParam) id: string,
    @Query(new ZodValidationPipe(listDealsQuerySchema)) query: ListDealsQuery,
  ) {
    return (await this.listDeals.execute(id, query)).map(DealPresenter.page);
  }
}
