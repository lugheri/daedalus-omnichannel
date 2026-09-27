import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { MEMBER_DIRECTORY } from './application/ports/member-directory';
import { TEAM_REPOSITORY } from './application/ports/team.repository';
import { TeamsFacade } from './application/teams.facade';
import {
  CreateTeamUseCase,
  DeleteTeamUseCase,
  ListTeamsUseCase,
  RenameTeamUseCase,
  SetTeamMembersUseCase,
} from './application/use-cases/manage-teams.use-cases';
import { TeamsController } from './http/teams.controller';
import { AccountsMemberDirectory } from './infra/accounts-member-directory';
import { PrismaTeamRepository } from './infra/prisma-team.repository';

/** Equipes de atendimento (ADR 0003: o cargo define o quê; a equipe, sobre quais dados). */
@Module({
  imports: [AccountsModule],
  controllers: [TeamsController],
  providers: [
    ListTeamsUseCase,
    CreateTeamUseCase,
    RenameTeamUseCase,
    SetTeamMembersUseCase,
    DeleteTeamUseCase,
    TeamsFacade,
    { provide: TEAM_REPOSITORY, useClass: PrismaTeamRepository },
    { provide: MEMBER_DIRECTORY, useClass: AccountsMemberDirectory },
  ],
  exports: [TeamsFacade],
})
export class TeamsModule {}
