/**
 * Máscara de telefone enquanto se digita. Padrão Brasil: `(11) 98765-4321` —
 * o backend completa o +55. Começando com `+` e outro código de país, fica
 * livre (só dígitos): `+1 5551234567`.
 *
 * Nunca acrescenta caracteres depois do último dígito (ex.: `(11) `), senão o
 * backspace ficaria preso num separador.
 */
export function formatPhoneInput(raw: string): string {
  const value = raw.trimStart()
  const digits = value.replace(/\D/g, '')

  if (value.startsWith('+')) {
    if (!digits.startsWith('55')) return `+${digits.slice(0, 15)}`
    const national = formatBrazilian(digits.slice(2))
    return national ? `+55 ${national}` : '+55'
  }
  return formatBrazilian(digits)
}

function formatBrazilian(input: string): string {
  const digits = input.slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`

  const ddd = digits.slice(0, 2)
  const number = digits.slice(2)
  // Celular (9 dígitos) quebra 5-4; fixo (8) quebra 4-4.
  const split = number.length > 8 ? 5 : 4
  if (number.length <= split) return `(${ddd}) ${number}`
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`
}

/** Exibe um número E.164 (`+5511987654321`) no formato local, se for do Brasil. */
export function formatPhone(e164: string): string {
  if (e164.startsWith('+55') && (e164.length === 13 || e164.length === 14)) {
    return formatBrazilian(e164.slice(3))
  }
  return e164
}
