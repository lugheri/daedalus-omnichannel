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
import { RequireAnyPermission } from '../../accounts';
import {
  CreateDealUseCase,
  DeleteDealUseCase,
  GetDealUseCase,
  ListContactDealsUseCase,
  ListConversationDealsUseCase,
  MoveDealUseCase,
  SetDealStatusUseCase,
  UpdateDealUseCase,
} from '../application/use-cases/deals.use-cases';
import {
  createDealSchema,
  dealStatusSchema,
  dealsQuerySchema,
  moveDealSchema,
  updateDealSchema,
  type CreateDealDto,
  type DealStatusDto,
  type DealsQuery,
  type MoveDealDto,
  type UpdateDealDto,
} from './dto/kanban.dto';
import { DealPresenter } from './kanban.presenter';

const idParam = new ZodValidationPipe(z.uuid());

/**
 * Negócios. Qualquer escopo de conversas; cada um vê e mexe só nos negócios
 * que enxerga (supervisão: todos; atendente: os seus, os sem responsável e
 * os das conversas que vê).
 */
@RequireAnyPermission('conversations:view:own', 'conversations:view:team', 'conversations:view:all')
@Controller('v1/deals')
export class DealsController {
  constructor(
    private readonly createDeal: CreateDealUseCase,
    private readonly getDeal: GetDealUseCase,
    private readonly updateDeal: UpdateDealUseCase,
    private readonly moveDeal: MoveDealUseCase,
    private readonly setStatus: SetDealStatusUseCase,
    private readonly deleteDeal: DeleteDealUseCase,
    private readonly contactDeals: ListContactDealsUseCase,
    private readonly conversationDeals: ListConversationDealsUseCase,
  ) {}

  /** `?contactId=` (ficha: todos) ou `?conversationId=` (chat: os em aberto). */
  @Get()
  async list(@Query(new ZodValidationPipe(dealsQuerySchema)) query: DealsQuery) {
    const placed =
      'contactId' in query
        ? await this.contactDeals.execute(query.contactId)
        : await this.conversationDeals.execute(query.conversationId);
    return placed.map(DealPresenter.placed);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createDealSchema)) body: CreateDealDto) {
    return DealPresenter.toHttp(await this.createDeal.execute(body));
  }

  @Get(':id')
  async get(@Param('id', idParam) id: string) {
    return DealPresenter.placed(await this.getDeal.execute(id));
  }

  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateDealSchema)) body: UpdateDealDto,
  ) {
    return DealPresenter.toHttp(await this.updateDeal.execute(id, body));
  }

  @Post(':id/move')
  async move(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(moveDealSchema)) body: MoveDealDto,
  ) {
    return DealPresenter.toHttp(await this.moveDeal.execute({ dealId: id, ...body }));
  }

  /** Ganho, perdido (com motivo opcional) ou reaberto. */
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  async status(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(dealStatusSchema)) body: DealStatusDto,
  ) {
    return DealPresenter.toHttp(await this.setStatus.execute(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deleteDeal.execute(id);
  }
}
