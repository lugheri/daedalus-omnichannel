const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Centavos → "R$ 1.250,90". */
export function formatMoney(cents: number): string {
  return currency.format(cents / 100)
}

/** Centavos → texto de campo ("1.250,00"); vazio quando não há valor. */
export function moneyToInput(cents: number | null): string {
  return cents === null ? '' : decimal.format(cents / 100)
}

/**
 * Texto de campo → centavos. Aceita "50", "50,5", "1.234,56" e "R$ 50,00";
 * vazio = sem valor (null); `undefined` = não dá para entender.
 */
export function parseMoney(text: string): number | null | undefined {
  const clean = text.replace(/R\$|\s/g, '')
  if (!clean) return null
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(clean)) return undefined
  const [reais, centavos = ''] = clean.replace(/\./g, '').split(',')
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'))
}
