/**
 * API pública do módulo identity. Outros módulos só podem importar daqui.
 */
export type { AuthTokens } from './application/auth-tokens';
export type { AuthenticatedAccess } from './application/use-cases/authenticate-access-token/authenticate-access-token.use-case';
export { IdentityFacade, type UserSummary } from './application/identity.facade';
export { UserRegisteredEvent } from './domain/events/user-registered.event';
// Comando de operação (src/reset-password.ts), não usado por outros módulos.
export { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';
export { AuthTokensPresenter } from './http/auth-tokens.presenter';
export { RefreshTokenCookie } from './http/refresh-token-cookie';
export { IdentityModule } from './identity.module';
