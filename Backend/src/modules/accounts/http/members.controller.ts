import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { ChangeMemberRoleUseCase } from '../application/use-cases/members/change-member-role.use-case';
import { ListMembersUseCase } from '../application/use-cases/members/list-members.use-case';
import { SetMemberStatusUseCase } from '../application/use-cases/members/set-member-status.use-case';
import { changeMemberRoleSchema, idParam, type ChangeMemberRoleDto } from './dto/management.dto';
import { MemberPresenter } from './management.presenters';
import { RequirePermissions } from './require-permissions.decorator';

@RequirePermissions('members:manage')
@Controller('v1/members')
export class MembersController {
  constructor(
    private readonly listMembers: ListMembersUseCase,
    private readonly changeMemberRole: ChangeMemberRoleUseCase,
    private readonly setMemberStatus: SetMemberStatusUseCase,
  ) {}

  @Get()
  async list() {
    return (await this.listMembers.execute()).map((member) => MemberPresenter.toHttp(member));
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeRole(
    @Param('id', new ZodValidationPipe(idParam)) membershipId: string,
    @Body(new ZodValidationPipe(changeMemberRoleSchema)) body: ChangeMemberRoleDto,
  ) {
    await this.changeMemberRole.execute({ membershipId, roleId: body.roleId });
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable(@Param('id', new ZodValidationPipe(idParam)) membershipId: string) {
    await this.setMemberStatus.execute({ membershipId, active: false });
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async enable(@Param('id', new ZodValidationPipe(idParam)) membershipId: string) {
    await this.setMemberStatus.execute({ membershipId, active: true });
  }
}
