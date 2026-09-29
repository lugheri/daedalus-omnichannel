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
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  CreateDispositionUseCase,
  DeleteDispositionUseCase,
  ListDispositionsUseCase,
  UpdateDispositionUseCase,
} from '../application/use-cases/dispositions/dispositions.use-cases';
import { DispositionPresenter } from './conversation.presenter';
import {
  createDispositionSchema,
  updateDispositionSchema,
  type CreateDispositionDto,
  type UpdateDispositionDto,
} from './dto/conversation.dto';

const idParam = new ZodValidationPipe(z.uuid());

/**
 * Tabulações da conta. A lista (com as arquivadas, marcadas) é aberta a todo
 * membro: quem atende precisa das opções e do nome das já usadas.
 */
@Controller('v1/dispositions')
export class DispositionsController {
  constructor(
    private readonly listDispositions: ListDispositionsUseCase,
    private readonly createDisposition: CreateDispositionUseCase,
    private readonly updateDisposition: UpdateDispositionUseCase,
    private readonly deleteDisposition: DeleteDispositionUseCase,
  ) {}

  @Get()
  async list() {
    return (await this.listDispositions.execute()).map(DispositionPresenter.toHttp);
  }

  @RequirePermissions('dispositions:manage')
  @Post()
  async create(@Body(new ZodValidationPipe(createDispositionSchema)) body: CreateDispositionDto) {
    return DispositionPresenter.toHttp(await this.createDisposition.execute(body));
  }

  /** Renomear, trocar a cor, arquivar (`archived: true`) ou reativar. */
  @RequirePermissions('dispositions:manage')
  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateDispositionSchema)) body: UpdateDispositionDto,
  ) {
    return DispositionPresenter.toHttp(await this.updateDisposition.execute(id, body));
  }

  /** Só se nunca foi usada; usada, arquive. */
  @RequirePermissions('dispositions:manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deleteDisposition.execute(id);
  }
}
