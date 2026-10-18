/** Valor do Select para "sem formulário". */
export const NO_FORM = 'none'

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : percent.format(rate)
}
