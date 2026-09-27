/** Formato E.164 (+ código do país + número), usado por WhatsApp e afins. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** País assumido quando o número vem sem código de país (MVP: só Brasil). */
const DEFAULT_COUNTRY_CODE = '55';

/**
 * DDD (dois dígitos, sem zero) + celular (9 dígitos, começando com 9) ou
 * fixo/celular antigo (8 dígitos, sem começar com 0 ou 1).
 */
const BR_NATIONAL = /^[1-9]{2}(9\d{8}|[2-9]\d{7})$/;

/**
 * Normaliza um telefone digitado para E.164, ou `null` se não der para
 * entender. Aceita:
 *   - internacional com `+`: `+55 (11) 98765-4321`, `+1 555 123 4567`;
 *   - nacional brasileiro (assume +55): `11987654321`, `(11) 98765-4321`,
 *     `011 98765-4321` (com o 0 de longa distância);
 *   - brasileiro com país mas sem `+`: `5511987654321`.
 * Números de outros países precisam do `+` (sem ele, não há como saber o país).
 */
export function normalizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    const e164 = `+${digits}`;
    return E164.test(e164) ? e164 : null;
  }

  const national = digits.replace(/^0/, '');
  if (BR_NATIONAL.test(national)) return `+${DEFAULT_COUNTRY_CODE}${national}`;

  if (
    digits.startsWith(DEFAULT_COUNTRY_CODE) &&
    BR_NATIONAL.test(digits.slice(DEFAULT_COUNTRY_CODE.length))
  ) {
    return `+${digits}`;
  }
  return null;
}
