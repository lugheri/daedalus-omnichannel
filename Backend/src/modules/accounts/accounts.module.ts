import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity';
import { IDENTITY_GATEWAY } from './application/ports/identity.gateway';
import { MEMBERSHIP_REPOSITORY } from './application/ports/membership.repository';
import { ROLE_REPOSITORY } from './application/ports/role.repository';
import { TENANT_REPOSITORY } from './application/ports/tenant.repository';
import { LogInUseCase } from './application/use-cases/log-in/log-in.use-case';
import { SignUpUseCase } from './application/use-cases/sign-up/sign-up.use-case';
import { AuthController } from './http/auth.controller';
import { IdentityFacadeGateway } from './infra/identity-facade.gateway';
import {
  PrismaMembershipRepository,
  PrismaRoleRepository,
  PrismaTenantRepository,
} from './infra/prisma-accounts.repositories';

/**
 * Depende do identity (nunca o contrário): accounts orquestra cadastro e
 * login usando a API pública do identity.
 */
@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
  providers: [
    SignUpUseCase,
    LogInUseCase,
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    { provide: MEMBERSHIP_REPOSITORY, useClass: PrismaMembershipRepository },
    { provide: IDENTITY_GATEWAY, useClass: IdentityFacadeGateway },
  ],
})
export class AccountsModule {}
