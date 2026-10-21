/**
 * Links para falar com o contato por fora do sistema (WhatsApp do celular,
 * discador, programa de e-mail). Solução mínima para atender o lead do
 * formulário enquanto o sistema não inicia conversa por conta própria.
 *
 * O telefone vem da API em E.164 (`+5511987654321`). Por garantia, um número
 * sem `+` com 10 ou 11 dígitos é tratado como brasileiro (DDD + número) e ganha
 * o 55; qualquer outro formato vai como está, só com os dígitos.
 */
function internationalDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!phone.trim().startsWith('+') && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`
  }
  // Menos que isso não é um número que o WhatsApp ou o discador aceitem.
  return digits.length >= 8 ? digits : null
}

/** `https://wa.me/<DDI+número>`: abre a conversa no WhatsApp (app ou Web). */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const digits = phone ? internationalDigits(phone) : null
  return digits ? `https://wa.me/${digits}` : null
}

/** `tel:+<DDI+número>`: no celular, abre o discador. */
export function telUrl(phone: string | null | undefined): string | null {
  const digits = phone ? internationalDigits(phone) : null
  return digits ? `tel:+${digits}` : null
}

/** `mailto:`: abre o programa de e-mail do aparelho. */
export function mailtoUrl(email: string | null | undefined): string | null {
  const value = email?.trim()
  return value && value.includes('@')
    ? `mailto:${encodeURIComponent(value).replace('%40', '@')}`
    : null
}
