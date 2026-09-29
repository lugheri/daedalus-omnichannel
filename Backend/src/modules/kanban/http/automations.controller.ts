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
  CreateAutomationUseCase,
  DeleteAutomationUseCase,
  ListAutomationRunsUseCase,
  ListAutomationsUseCase,
  UpdateAutomationUseCase,
} from '../application/automations/automation-rules.use-cases';
import { AutomationPresenter } from './automation.presenter';
import {
  createAutomationSchema,
  updateAutomationSchema,
  type CreateAutomationDto,
  type UpdateAutomationDto,
} from './dto/automation.dto';

const idParam = new ZodValidationPipe(z.uuid());

/** Automações das colunas de um quadro. Tudo exige `boards:manage`. */
@RequirePermissions('boards:manage')
@Controller('v1/boards/:boardId/automations')
export class AutomationsController {
  constructor(
    private readonly listAutomations: ListAutomationsUseCase,
    private readonly createAutomation: CreateAutomationUseCase,
    private readonly updateAutomation: UpdateAutomationUseCase,
    private readonly deleteAutomation: DeleteAutomationUseCase,
    private readonly listRuns: ListAutomationRunsUseCase,
  ) {}

  @Get()
  async list(@Param('boardId', idParam) boardId: string) {
    return (await this.listAutomations.execute(boardId)).map(AutomationPresenter.toHttp);
  }

  @Post()
  async create(
    @Param('boardId', idParam) boardId: string,
    @Body(new ZodValidationPipe(createAutomationSchema)) body: CreateAutomationDto,
  ) {
    return AutomationPresenter.toHttp(await this.createAutomation.execute(boardId, body));
  }

  @Patch(':ruleId')
  async update(
    @Param('boardId', idParam) boardId: string,
    @Param('ruleId', idParam) ruleId: string,
    @Body(new ZodValidationPipe(updateAutomationSchema)) body: UpdateAutomationDto,
  ) {
    return AutomationPresenter.toHttp(await this.updateAutomation.execute(boardId, ruleId, body));
  }

  @Delete(':ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('boardId', idParam) boardId: string,
    @Param('ruleId', idParam) ruleId: string,
  ) {
    await this.deleteAutomation.execute(boardId, ruleId);
  }

  /** Últimas 20 execuções da regra. */
  @Get(':ruleId/runs')
  async runs(@Param('boardId', idParam) boardId: string, @Param('ruleId', idParam) ruleId: string) {
    return (await this.listRuns.execute(boardId, ruleId)).map(AutomationPresenter.run);
  }
}
