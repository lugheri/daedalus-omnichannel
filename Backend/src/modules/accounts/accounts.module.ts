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
import { API_KEY_SECRET_GENERATOR } from './application/ports/api-key-secret-generator';
import { API_KEY_REPOSITORY } from './application/ports/api-key.repository';
import { INVITATION_TOKEN_GENERATOR } from './application/ports/invitation-token-generator';
import {
  AuthenticateApiKeyUseCase,
  CreateApiKeyUseCase,
  ListApiKeysUseCase,
  RevokeApiKeyUseCase,
} from './application/use-cases/api-keys/api-keys.use-cases';
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
import {
  ListMyAccountsUseCase,
  SwitchAccountUseCase,
} from './application/use-cases/my-accounts/my-accounts.use-cases';
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
import { AccountSwitchController } from './http/account-switch.controller';
import { AuthController } from './http/auth.controller';
import {
  InvitationAcceptanceController,
  InvitationsController,
} from './http/invitations.controller';
import { MeController } from './http/me.controller';
import { ApiKeyGuard } from './http/api-key.guard';
import { ApiKeysController } from './http/api-keys.controller';
import { MemberDirectoryController } from './http/member-directory.controller';
import { MembersController } from './http/members.controller';
import { RolesController } from './http/roles.controller';
import { CryptoApiKeySecretGenerator } from './infra/crypto-api-key-secret-generator';
import { CryptoInvitationTokenGenerator } from './infra/crypto-invitation-token-generator';
import { PrismaApiKeyRepository } from './infra/prisma-api-key.repository';
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
    AccountSwitchController,
    MeController,
    MemberDirectoryController,
    ApiKeysController,
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
    ListMyAccountsUseCase,
    SwitchAccountUseCase,
    CurrentAccess,
    AccountsFacade,
    { provide: APP_GUARD, useClass: AccessGuard },
    // Membros
    ListMembersUseCase,
    ListMemberDirectoryUseCase,
    // Chaves de API
    ListApiKeysUseCase,
    CreateApiKeyUseCase,
    RevokeApiKeyUseCase,
    AuthenticateApiKeyUseCase,
    ApiKeyGuard,
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
    { provide: API_KEY_REPOSITORY, useClass: PrismaApiKeyRepository },
    { provide: API_KEY_SECRET_GENERATOR, useClass: CryptoApiKeySecretGenerator },
    { provide: ACCESS_CACHE, useClass: RedisAccessCache },
    { provide: IDENTITY_GATEWAY, useClass: IdentityFacadeGateway },
    {
      provide: ACCOUNTS_SETTINGS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): AccountsSettings => ({ appUrl: config.appUrl }),
    },
  ],
  // ApiKeyGuard e o use case que ele usa: rotas de outros módulos usam @ApiKeyAuth().
  exports: [AccountsFacade, ApiKeyGuard, AuthenticateApiKeyUseCase],
})
export class AccountsModule {}
