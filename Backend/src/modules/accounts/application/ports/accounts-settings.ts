export interface AccountsSettings {
  /** URL base do frontend, para montar o link de convite (`<appUrl>/invite/<token>`). */
  appUrl: string;
}

export const ACCOUNTS_SETTINGS = Symbol('AccountsSettings');
