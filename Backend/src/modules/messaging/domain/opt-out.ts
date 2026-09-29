import type { MessagingChannel } from './messaging-provider.entity';

export type OptOutSource = 'unsubscribe_link' | 'sms_reply' | 'provider' | 'manual';

/** Descadastro de um endereço (e-mail ou telefone E.164) num canal. */
export interface OptOut {
  tenantId: string;
  channel: MessagingChannel;
  address: string;
  source: OptOutSource;
  createdAt: Date;
}

/** Palavras que, respondidas por SMS, descadastram (sem acento, sem diferenciar caixa). */
const SMS_OPT_OUT_WORDS = new Set([
  'sair',
  'parar',
  'pare',
  'stop',
  'cancelar',
  'descadastrar',
  'remover',
  'unsubscribe',
]);

/** A resposta do cliente é um pedido de descadastro? Só a palavra sozinha conta. */
export function isSmsOptOutReply(body: string): boolean {
  const word = body
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/[.!\s]+$/, '')
    .toLowerCase();
  return SMS_OPT_OUT_WORDS.has(word);
}
