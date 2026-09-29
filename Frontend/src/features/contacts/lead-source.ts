import type { LeadSource } from './api'

/** Rótulos das origens de lead (espelho de `LEAD_SOURCES` do backend). */
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: 'WhatsApp',
  manual: 'Cadastro manual',
  import: 'Importação',
  web_form: 'Formulário do site',
}

export const LEAD_SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]
