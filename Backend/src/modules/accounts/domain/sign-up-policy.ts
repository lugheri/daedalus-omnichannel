/**
 * Situação do cadastro público de contas (ADR 0004, adendo de 20/10/2026):
 *
 * - `bootstrap`: o banco não tem conta nenhuma. Aceita a PRIMEIRA, que vai
 *   virar a raiz pelo `designate-root` — mesmo com o cadastro desligado,
 *   senão não haveria como criar a conta da plataforma.
 * - `platform-not-ready`: já existe conta, mas a raiz ainda não foi
 *   designada. Recusa: a conta nasceria sem mãe e no plano padrão, e o
 *   `designate-root` a adotaria depois sem ninguém ter decidido isso.
 * - `disabled`: raiz definida e cadastro público desligado na configuração.
 * - `open`: raiz definida e cadastro ligado; a conta nasce abaixo da raiz.
 */
export type SignUpAvailability = 'open' | 'bootstrap' | 'disabled' | 'platform-not-ready';

export interface SignUpConditions {
  /** `PUBLIC_SIGNUP_ENABLED`. */
  publicSignupEnabled: boolean;
  hasRoot: boolean;
  hasAnyAccount: boolean;
}

export function signUpAvailability(conditions: SignUpConditions): SignUpAvailability {
  if (conditions.hasRoot) return conditions.publicSignupEnabled ? 'open' : 'disabled';
  return conditions.hasAnyAccount ? 'platform-not-ready' : 'bootstrap';
}

export function isSignUpAccepted(availability: SignUpAvailability): boolean {
  return availability === 'open' || availability === 'bootstrap';
}
