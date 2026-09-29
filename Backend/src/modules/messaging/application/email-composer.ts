import type { EmailMessage } from './ports/provider-clients';

/**
 * Monta o e-mail: texto puro + HTML (o texto escapado, com quebras de linha)
 * e o rodapé de descadastro nos dois. Os cabeçalhos List-Unsubscribe (RFC
 * 8058) deixam Gmail/Outlook mostrarem o "cancelar inscrição" de um clique —
 * exigência deles para quem envia em volume.
 */
export function composeEmail(input: {
  to: string;
  subject: string;
  body: string;
  senderName: string;
  unsubscribeUrl: string;
  messageId: string;
}): EmailMessage {
  const footerText = `—\nNão quer mais receber e-mails de ${input.senderName}? Descadastre-se: ${input.unsubscribeUrl}`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">` +
    `${escapeHtml(input.body).replace(/\r?\n/g, '<br>')}</div>` +
    `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666;margin-top:24px">` +
    `Não quer mais receber e-mails de ${escapeHtml(input.senderName)}? ` +
    `<a href="${escapeHtml(input.unsubscribeUrl)}">Descadastre-se</a>.</p>`;
  return {
    to: input.to,
    subject: input.subject,
    text: `${input.body}\n\n${footerText}`,
    html,
    headers: {
      'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    customArgs: { omni_message_id: input.messageId },
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
