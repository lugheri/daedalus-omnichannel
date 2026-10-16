const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 50,00"; sem preço = "Sob consulta". */
export function formatPrice(cents: number | null): string {
  return cents === null ? 'Sob consulta' : currency.format(cents / 100)
}

/** Centavos → texto do campo ("50,00"); vazio quando sob consulta. */
export function priceToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * Texto do campo → centavos. Aceita "50", "50,5", "1.234,56" e "R$ 50,00";
 * vazio = sob consulta (null); `undefined` = não dá para entender.
 */
export function parsePrice(text: string): number | null | undefined {
  const clean = text.replace(/R\$|\s/g, '')
  if (!clean) return null
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(clean)) return undefined
  const [reais, centavos = ''] = clean.replace(/\./g, '').split(',')
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'))
}

/** 30 → "30 min"; 90 → "1h30"; 120 → "2h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** Opções do seletor de duração (5 min a 12 h). */
export const DURATION_OPTIONS = [
  5, 10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 480, 600, 720,
]
