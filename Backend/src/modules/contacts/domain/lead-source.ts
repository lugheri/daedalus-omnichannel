/**
 * De onde o contato veio — base dos relatórios de origem de leads.
 * - `whatsapp`: criado pela primeira mensagem recebida;
 * - `manual`: cadastrado por alguém da equipe;
 * - `import`: importação de planilha;
 * - `web_form`: formulário do site (API de entrada de leads).
 */
export const LEAD_SOURCES = ['whatsapp', 'manual', 'import', 'web_form'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

const MAX_DETAIL = 200;

/** Detalhe livre da origem (campanha, página...): aparado; vazio vira null. */
export function sourceDetailOf(raw: string | null | undefined): string | null {
  const detail = raw?.trim().slice(0, MAX_DETAIL);
  return detail || null;
}
