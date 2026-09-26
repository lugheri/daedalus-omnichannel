import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/app-config';
import { AuthTokensFactory } from './application/auth-tokens.factory';
import { IdentityFacade } from './application/identity.facade';
import { ACCESS_TOKEN_ISSUER } from './application/ports/access-token-issuer';
import { ACCESS_TOKEN_VERIFIER } from './application/ports/access-token-verifier';
import { IDENTITY_SETTINGS, type IdentitySettings } from './application/ports/identity-settings';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import { REFRESH_SECRET_GENERATOR } from './application/ports/refresh-secret-generator';
import { SESSION_REPOSITORY } from './application/ports/session.repository';
import { USER_REPOSITORY } from './application/ports/user.repository';
import { AuthenticateAccessTokenUseCase } from './application/use-cases/authenticate-access-token/authenticate-access-token.use-case';
import { EndSessionUseCase } from './application/use-cases/end-session/end-session.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session/refresh-session.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user/register-user.use-case';
import { StartSessionUseCase } from './application/use-cases/start-session/start-session.use-case';
import { VerifyCredentialsUseCase } from './application/use-cases/verify-credentials/verify-credentials.use-case';
import { AuthSessionController } from './http/auth-session.controller';
import { JwtAuthGuard } from './http/jwt-auth.guard';
import { RefreshTokenCookie } from './http/refresh-token-cookie';
import { Argon2PasswordHasher } from './infra/argon2-password-hasher';
import { CryptoRefreshSecretGenerator } from './infra/crypto-refresh-secret-generator';
import { JwtAccessTokenIssuer } from './infra/jwt-access-token-issuer';
import { JwtAccessTokenVerifier } from './infra/jwt-access-token-verifier';
import { PrismaSessionRepository } from './infra/prisma-session.repository';
import { PrismaUserRepository } from './infra/prisma-user.repository';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: { algorithm: 'HS256', expiresIn: config.accessTokenTtlSeconds },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthSessionController],
  providers: [
    RegisterUserUseCase,
    VerifyCredentialsUseCase,
    StartSessionUseCase,
    RefreshSessionUseCase,
    EndSessionUseCase,
    AuthenticateAccessTokenUseCase,
    AuthTokensFactory,
    IdentityFacade,
    RefreshTokenCookie,
    // Autenticação obrigatória em TODAS as rotas da aplicação (exceto @Public).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: IDENTITY_SETTINGS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): IdentitySettings => ({
        accessTokenTtlSeconds: config.accessTokenTtlSeconds,
        refreshTokenTtlDays: config.refreshTokenTtlDays,
        secureCookies: config.isProduction,
      }),
    },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: REFRESH_SECRET_GENERATOR, useClass: CryptoRefreshSecretGenerator },
    { provide: ACCESS_TOKEN_ISSUER, useClass: JwtAccessTokenIssuer },
    { provide: ACCESS_TOKEN_VERIFIER, useClass: JwtAccessTokenVerifier },
  ],
  exports: [IdentityFacade, RefreshTokenCookie],
})
export class IdentityModule {}
