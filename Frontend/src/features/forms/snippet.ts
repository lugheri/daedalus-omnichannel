import { env } from '@/lib/env'
import type { SiteForm } from './api'

/** Endereço para onde o formulário publicado posta (a chave diz o formulário e a conta). */
export function formActionUrl(form: Pick<SiteForm, 'publicKey'>): string {
  return `${env.VITE_API_URL}/v1/public/forms/${form.publicKey}`
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * HTML pronto para colar no site: `<form method="post">` puro (funciona sem
 * JavaScript), com os nomes de campo que a API entende e o campo isca
 * `website` escondido (robô que preenche é descartado). O estilo fica num
 * bloco próprio (`.omni-form`), fácil de ajustar ou apagar.
 */
export function formSnippet(
  form: Pick<SiteForm, 'publicKey' | 'kind'>,
  services: { id: string; name: string }[] = [],
): string {
  const serviceFields =
    form.kind === 'service'
      ? `
  <label>Serviço
    <select name="servico" required>
      <option value="">Escolha…</option>${services
        .map((s) => `\n      <option value="${escape(s.id)}">${escape(s.name)}</option>`)
        .join('')}
    </select>
  </label>
  <label>Quando você prefere?
    <input name="data_preferida" maxlength="100" placeholder="Ex.: sábado de manhã">
  </label>`
      : ''

  return `<form class="omni-form" method="post" action="${formActionUrl(form)}">
  <label>Nome
    <input name="nome" maxlength="120" autocomplete="name" required>
  </label>
  <label>WhatsApp ou telefone
    <input name="telefone" type="tel" maxlength="40" autocomplete="tel" placeholder="(11) 99999-9999">
  </label>
  <label>E-mail
    <input name="email" type="email" maxlength="320" autocomplete="email">
  </label>${serviceFields}
  <label>Mensagem
    <textarea name="mensagem" rows="4" maxlength="2000"></textarea>
  </label>
  <!-- Campo isca contra robôs: deixe escondido e vazio. -->
  <input class="omni-form-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button type="submit">${form.kind === 'service' ? 'Solicitar' : 'Enviar'}</button>
  <small>Informe telefone ou e-mail para retornarmos.</small>
</form>
<style>
  .omni-form{display:grid;gap:12px;max-width:440px;font:16px/1.4 system-ui,sans-serif}
  .omni-form label{display:grid;gap:4px;font-weight:600}
  .omni-form input,.omni-form select,.omni-form textarea{font:inherit;font-weight:400;padding:10px;border:1px solid #c5ccd8;border-radius:8px}
  .omni-form button{font:inherit;font-weight:600;padding:12px;border:0;border-radius:8px;background:#2f5bd7;color:#fff;cursor:pointer}
  .omni-form small{color:#5a6273}
  .omni-form .omni-form-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
</style>`
}
