import { formatMoney, moneyToInput, parseMoney } from '@/lib/money'

/** "R$ 50,00"; sem preço = "Sob consulta". */
export function formatPrice(cents: number | null): string {
  return cents === null ? 'Sob consulta' : formatMoney(cents)
}

/** Preço do serviço no campo: vazio = sob consulta. */
export const priceToInput = moneyToInput
export const parsePrice = parseMoney

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
