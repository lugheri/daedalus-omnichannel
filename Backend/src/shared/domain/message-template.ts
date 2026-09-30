/**
 * Preenche o texto de uma mensagem automática:
 * - `{{nome}}` → primeiro nome do contato;
 * - `{{nome_completo}}` → nome inteiro.
 *
 * Sem nome, a variável some e a pontuação é arrumada ("Olá {{nome}}, tudo
 * bem?" vira "Olá, tudo bem?").
 */
export function renderTemplate(text: string, contact: { name: string | null }): string {
  const full = contact.name?.trim().replace(/\s+/g, ' ') ?? '';
  const first = full.split(' ')[0] ?? '';
  return (
    text
      .replace(/\{\{\s*nome_completo\s*\}\}/gi, full)
      .replace(/\{\{\s*nome\s*\}\}/gi, first)
      .replace(/[ \t]+([,.!?;:])/g, '$1')
      // "interesse, {{nome}}?" sem nome: a vírgula órfã some ("interesse?").
      .replace(/,+(?=[.!?])/g, '')
      .replace(/,{2,}/g, ',')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^[ \t]*,[ \t]*/, '')
      .trim()
  );
}
