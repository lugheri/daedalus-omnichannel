/** Parâmetros de sessão que o módulo precisa, sem depender do AppConfig inteiro. */
export interface IdentitySettings {
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
}

export const IDENTITY_SETTINGS = Symbol('IdentitySettings');
