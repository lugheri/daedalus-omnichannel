/** Gera senhas temporárias fortes (redefinição manual de senha). */
export interface TemporaryPasswordGenerator {
  generate(): string;
}

export const TEMPORARY_PASSWORD_GENERATOR = Symbol('TemporaryPasswordGenerator');
