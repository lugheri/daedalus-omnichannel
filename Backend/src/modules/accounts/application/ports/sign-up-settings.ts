/**
 * Configuração do cadastro público. Port próprio (e não um campo a mais no
 * `AccountsSettings`) porque só o `SignUpGate` precisa dela.
 */
export interface SignUpSettings {
  /** `PUBLIC_SIGNUP_ENABLED`: false = contas novas só por convite / conta filha. */
  publicSignupEnabled: boolean;
}

export const SIGN_UP_SETTINGS = Symbol('SignUpSettings');
