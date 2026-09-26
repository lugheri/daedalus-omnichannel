/**
 * API pública do módulo identity. Outros módulos só podem importar daqui.
 */
export type { AuthTokens } from './application/auth-tokens';
export { IdentityFacade, type UserSummary } from './application/identity.facade';
export { UserRegisteredEvent } from './domain/events/user-registered.event';
export { AuthTokensPresenter } from './http/auth-tokens.presenter';
export { RefreshTokenCookie } from './http/refresh-token-cookie';
export { IdentityModule } from './identity.module';
