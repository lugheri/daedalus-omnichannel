import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfig } from '../../config/app-config';
import { IdentityModule } from '../identity';
import { AccountsFacade } from './application/accounts.facade';
import { CurrentAccess } from './application/current-access';
import { ACCESS_CACHE } from './application/ports/access-cache';
import { ACCOUNTS_SETTINGS, type AccountsSettings } from './application/ports/accounts-settings';
import { IDENTITY_GATEWAY } from './application/ports/identity.gateway';
import { INVITATION_REPOSITORY } from './application/ports/invitation.repository';
import { INVITATION_TOKEN_GENERATOR } from './application/ports/invitation-token-generator';
import { MEMBERSHIP_REPOSITORY } from './application/ports/membership.repository';
import { ROLE_REPOSITORY } from './application/ports/role.repository';
import { TENANT_REPOSITORY } from './application/ports/tenant.repository';
import { GetMeUseCase } from './application/use-cases/get-me/get-me.use-case';
import {
  AcceptInvitationUseCase,
  LookUpInvitationUseCase,
} from './application/use-cases/invitations/accept-invitation.use-case';
import { InviteMemberUseCase } from './application/use-cases/invitations/invite-member.use-case';
import {
  ListInvitationsUseCase,
  RevokeInvitationUseCase,
} from './application/use-cases/invitations/manage-invitations.use-case';
import { LogInUseCase } from './application/use-cases/log-in/log-in.use-case';
import { ChangeMemberRoleUseCase } from './application/use-cases/members/change-member-role.use-case';
import { ListMemberDirectoryUseCase } from './application/use-cases/members/list-member-directory.use-case';
import { ListMembersUseCase } from './application/use-cases/members/list-members.use-case';
import { SetMemberStatusUseCase } from './application/use-cases/members/set-member-status.use-case';
import { ResolveAccessUseCase } from './application/use-cases/resolve-access/resolve-access.use-case';
import {
  CreateRoleUseCase,
  DeleteRoleUseCase,
  ListRolesUseCase,
  UpdateRoleUseCase,
} from './application/use-cases/roles/manage-roles.use-case';
import { SignUpUseCase } from './application/use-cases/sign-up/sign-up.use-case';
import { AccessGuard } from './http/access.guard';
import { AuthController } from './http/auth.controller';
import {
  InvitationAcceptanceController,
  InvitationsController,
} from './http/invitations.controller';
import { MeController } from './http/me.controller';
import { MemberDirectoryController } from './http/member-directory.controller';
import { MembersController } from './http/members.controller';
import { RolesController } from './http/roles.controller';
import { CryptoInvitationTokenGenerator } from './infra/crypto-invitation-token-generator';
import { IdentityFacadeGateway } from './infra/identity-facade.gateway';
import {
  PrismaInvitationRepository,
  PrismaMembershipRepository,
  PrismaRoleRepository,
  PrismaTenantRepository,
} from './infra/prisma-accounts.repositories';
import { RedisAccessCache } from './infra/redis-access-cache';

/**
 * Depende do identity (nunca o contrário): accounts orquestra cadastro,
 * login, convites e gestão de membros/cargos, e autoriza cada requisição.
 *
 * Ordem dos guards globais (pela ordem de importação dos módulos):
 * throttler (shared) → JwtAuthGuard (identity) → AccessGuard (accounts).
 * Por isso o AppModule importa IdentityModule antes de AccountsModule.
 */
@Module({
  imports: [IdentityModule],
  controllers: [
    AuthController,
    MeController,
    MemberDirectoryController,
    MembersController,
    InvitationsController,
    InvitationAcceptanceController,
    RolesController,
  ],
  providers: [
    // Autenticação e acesso
    SignUpUseCase,
    LogInUseCase,
    ResolveAccessUseCase,
    GetMeUseCase,
    CurrentAccess,
    AccountsFacade,
    { provide: APP_GUARD, useClass: AccessGuard },
    // Membros
    ListMembersUseCase,
    ListMemberDirectoryUseCase,
    ChangeMemberRoleUseCase,
    SetMemberStatusUseCase,
    // Convites
    InviteMemberUseCase,
    ListInvitationsUseCase,
    RevokeInvitationUseCase,
    LookUpInvitationUseCase,
    AcceptInvitationUseCase,
    // Cargos
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    // Adapters
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    { provide: MEMBERSHIP_REPOSITORY, useClass: PrismaMembershipRepository },
    { provide: INVITATION_REPOSITORY, useClass: PrismaInvitationRepository },
    { provide: INVITATION_TOKEN_GENERATOR, useClass: CryptoInvitationTokenGenerator },
    { provide: ACCESS_CACHE, useClass: RedisAccessCache },
    { provide: IDENTITY_GATEWAY, useClass: IdentityFacadeGateway },
    {
      provide: ACCOUNTS_SETTINGS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): AccountsSettings => ({ appUrl: config.appUrl }),
    },
  ],
  exports: [AccountsFacade],
})
export class AccountsModule {}
