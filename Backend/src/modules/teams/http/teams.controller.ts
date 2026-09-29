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
  Put,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequireAnyPermission, RequirePermissions } from '../../accounts';
import {
  CreateTeamUseCase,
  DeleteTeamUseCase,
  ListTeamsUseCase,
  RenameTeamUseCase,
  SetTeamMembersUseCase,
} from '../application/use-cases/manage-teams.use-cases';
import type { Team } from '../domain/team.entity';
import {
  setTeamMembersSchema,
  teamNameSchema,
  type SetTeamMembersDto,
  type TeamNameDto,
} from './dto/team.dto';

const idParam = new ZodValidationPipe(z.uuid());

const present = (team: Team) => ({
  id: team.id,
  name: team.name,
  memberIds: [...team.memberIds],
  createdAt: team.createdAt.toISOString(),
});

@Controller('v1/teams')
export class TeamsController {
  constructor(
    private readonly listTeams: ListTeamsUseCase,
    private readonly createTeam: CreateTeamUseCase,
    private readonly renameTeam: RenameTeamUseCase,
    private readonly setMembers: SetTeamMembersUseCase,
    private readonly deleteTeam: DeleteTeamUseCase,
  ) {}

  /**
   * Também para quem transfere conversas (equipe de destino) e quem configura
   * quadros (entrada automática por equipe).
   */
  @RequireAnyPermission('teams:manage', 'conversations:assign', 'boards:manage')
  @Get()
  async list() {
    return (await this.listTeams.execute()).map(present);
  }

  @RequirePermissions('teams:manage')
  @Post()
  async create(@Body(new ZodValidationPipe(teamNameSchema)) body: TeamNameDto) {
    return present(await this.createTeam.execute(body));
  }

  @RequirePermissions('teams:manage')
  @Patch(':id')
  async rename(
    @Param('id', idParam) teamId: string,
    @Body(new ZodValidationPipe(teamNameSchema)) body: TeamNameDto,
  ) {
    return present(await this.renameTeam.execute({ teamId, name: body.name }));
  }

  @RequirePermissions('teams:manage')
  @Put(':id/members')
  async members(
    @Param('id', idParam) teamId: string,
    @Body(new ZodValidationPipe(setTeamMembersSchema)) body: SetTeamMembersDto,
  ) {
    return present(await this.setMembers.execute({ teamId, memberIds: body.memberIds }));
  }

  @RequirePermissions('teams:manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) teamId: string) {
    await this.deleteTeam.execute(teamId);
  }
}
