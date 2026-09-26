/** Parâmetros de sessão que o módulo precisa, sem depender do AppConfig inteiro. */
export interface IdentitySettings {
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  /** Cookies só via HTTPS. Desligado apenas em desenvolvimento (localhost em HTTP). */
  secureCookies: boolean;
}

export const IDENTITY_SETTINGS = Symbol('IdentitySettings');
