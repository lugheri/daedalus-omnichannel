import { escapeHtml } from '../application/email-composer';
import type { UnsubscribePage } from '../application/use-cases/unsubscribe.use-cases';

/**
 * Página de descadastro (HTML simples, servido pela API: o contato não tem
 * conta no app). Sem scripts; o botão é um formulário POST para a mesma URL.
 */
export function unsubscribePage(
  page: UnsubscribePage | null,
  token: string,
): { status: number; html: string } {
  if (!page) {
    return {
      status: 404,
      html: layout(
        'Link inválido',
        '<p>Este link de descadastro não é válido. Se quiser parar de receber mensagens, responda o e-mail pedindo o descadastro.</p>',
      ),
    };
  }
  const sender = escapeHtml(page.senderName);
  const address = escapeHtml(page.target.address);
  if (page.alreadyOptedOut) {
    return {
      status: 200,
      html: layout(
        'Descadastro confirmado',
        `<p><strong>${address}</strong> não vai mais receber e-mails de <strong>${sender}</strong>.</p>`,
      ),
    };
  }
  return {
    status: 200,
    html: layout(
      'Cancelar recebimento',
      `<p>Parar de enviar e-mails de <strong>${sender}</strong> para <strong>${address}</strong>?</p>
       <form method="post" action="${escapeHtml(encodeURIComponent(token))}">
         <button type="submit">Sim, não quero mais receber</button>
       </form>`,
    ),
  };
}

function layout(title: string, content: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; background: #f6f6f7; color: #111; margin: 0; }
  main { max-width: 440px; margin: 12vh auto; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 32px 28px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { line-height: 1.5; }
  button { font: inherit; background: #111; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer; margin-top: 8px; }
  button:focus-visible { outline: 3px solid #6b7280; outline-offset: 2px; }
</style>
</head>
<body><main><h1>${escapeHtml(title)}</h1>${content}</main></body>
</html>`;
}
