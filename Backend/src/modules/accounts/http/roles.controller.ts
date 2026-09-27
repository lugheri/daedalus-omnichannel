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
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import {
  CreateRoleUseCase,
  DeleteRoleUseCase,
  ListRolesUseCase,
  UpdateRoleUseCase,
} from '../application/use-cases/roles/manage-roles.use-case';
import {
  createRoleSchema,
  idParam,
  updateRoleSchema,
  type CreateRoleDto,
  type UpdateRoleDto,
} from './dto/management.dto';
import { RolePresenter } from './management.presenters';
import { RequireAnyPermission, RequirePermissions } from './require-permissions.decorator';

@Controller('v1/roles')
export class RolesController {
  constructor(
    private readonly listRoles: ListRolesUseCase,
    private readonly createRole: CreateRoleUseCase,
    private readonly updateRole: UpdateRoleUseCase,
    private readonly deleteRole: DeleteRoleUseCase,
  ) {}

  /** Quem convida ou troca cargos precisa ver a lista para escolher. */
  @Get()
  @RequireAnyPermission('roles:manage', 'members:manage')
  async list() {
    return (await this.listRoles.execute()).map((role) => RolePresenter.toHttp(role));
  }

  @Post()
  @RequirePermissions('roles:manage')
  async create(@Body(new ZodValidationPipe(createRoleSchema)) body: CreateRoleDto) {
    return RolePresenter.toHttp(await this.createRole.execute(body));
  }

  @Patch(':id')
  @RequirePermissions('roles:manage')
  async update(
    @Param('id', new ZodValidationPipe(idParam)) roleId: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: UpdateRoleDto,
  ) {
    return RolePresenter.toHttp(await this.updateRole.execute({ roleId, ...body }));
  }

  @Delete(':id')
  @RequirePermissions('roles:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParam)) roleId: string) {
    await this.deleteRole.execute(roleId);
  }
}
