/**
 * Páginas mínimas que o navegador do visitante vê depois de enviar um
 * formulário (quando o site não tem página de obrigado própria, ou deu erro).
 * HTML puro, sem script; todo texto variável passa por `escapeHtml`.
 */

const MESSAGES: Record<string, string> = {
  CONTACT_WITHOUT_IDENTIFIER: 'Informe um telefone ou e-mail para podermos responder.',
  CONTACT_INVALID_PHONE: 'O telefone parece incompleto. Confira o DDD e o número.',
  CONTACT_INVALID_EMAIL: 'O e-mail parece incorreto. Confira e tente de novo.',
  FORM_INACTIVE: 'Este formulário não está recebendo mensagens no momento.',
  FORM_UNKNOWN_SERVICE: 'O serviço escolhido não está mais disponível. Escolha outro.',
  FORM_INVALID_FIELD: 'Algum campo passou do tamanho permitido. Encurte e tente de novo.',
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f3f5f8;color:#13161c}
  main{max-width:420px;margin:24px;padding:28px;background:#fff;border:1px solid #dde2ea;border-radius:12px;text-align:center}
  h1{font-size:20px;margin:0 0 8px} p{margin:0 0 16px;color:#5a6273}
  a{color:#2f5bd7;font-weight:600;text-decoration:none}
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export function thanksPage(): string {
  return page(
    'Mensagem enviada',
    '<h1>Recebemos sua mensagem!</h1><p>Em breve entraremos em contato.</p>',
  );
}

/** `back`: de onde o formulário veio (Referer), para o botão voltar. */
export function errorPage(code: string, back: string | null): string {
  const message = MESSAGES[code] ?? 'Não foi possível enviar agora. Tente de novo em instantes.';
  const safeBack = back && /^https?:\/\//i.test(back) ? escapeHtml(back) : null;
  return page(
    'Não foi possível enviar',
    `<h1>Não foi possível enviar</h1><p>${escapeHtml(message)}</p>` +
      (safeBack ? `<a href="${safeBack}">Voltar ao formulário</a>` : ''),
  );
}
