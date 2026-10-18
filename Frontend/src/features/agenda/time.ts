import type { AppointmentStatus } from './api'

/**
 * Datas e horas da agenda. O dia é 'AAAA-MM-DD' e as horas são minutos desde
 * a meia-noite, sempre no fuso DA AGENDA (não no do navegador): quem marca em
 * outro fuso vê o relógio do estabelecimento. Só `Intl`, como no backend.
 */

const partsFormatters = new Map<string, Intl.DateTimeFormat>()
function partsIn(timeZone: string) {
  let format = partsFormatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, format)
  }
  return format
}

function wallClock(instant: Date, timeZone: string) {
  const values: Record<string, number> = {}
  for (const part of partsIn(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return values as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

function offsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** O instante (ISO) de `minutes` do dia `date` no fuso `timeZone`. */
export function zonedIso(date: string, minutes: number, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, minutes)
  let instant = guess - offsetMs(new Date(guess), timeZone)
  // Perto da troca de horário de verão, o deslocamento muda: recalcula uma vez.
  instant = guess - offsetMs(new Date(instant), timeZone)
  return new Date(instant).toISOString()
}

export function localDateOf(iso: string | Date, timeZone: string): string {
  const w = wallClock(new Date(iso), timeZone)
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`
}

export function minutesOf(iso: string, timeZone: string): number {
  const w = wallClock(new Date(iso), timeZone)
  return w.hour * 60 + w.minute
}

export function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export function todayIn(timeZone: string): string {
  return localDateOf(new Date(), timeZone)
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 0 = domingo. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** 540 → "09:00". */
export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** "09:00" → 540; inválido → null. */
export function parseHhmm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  return h < 24 && m < 60 ? h * 60 + m : null
}

export function timeIn(iso: string, timeZone: string): string {
  return hhmm(minutesOf(iso, timeZone))
}

/** "segunda-feira, 26 de outubro". */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** "26/10/2026 às 09:00" (no fuso da agenda). */
export function dateTimeIn(iso: string, timeZone: string): string {
  const date = localDateOf(iso, timeZone).split('-').reverse().join('/')
  return `${date} às ${timeIn(iso, timeZone)}`
}

/** "18/10/2026, dia inteiro", "18/10/2026 a 20/10/2026" ou "18/10/2026 às 12:00 até …". */
export function timeOffLabel(
  range: { startsAt: string; endsAt: string },
  timeZone: string,
): string {
  const br = (date: string) => date.split('-').reverse().join('/')
  if (minutesOf(range.startsAt, timeZone) === 0 && minutesOf(range.endsAt, timeZone) === 0) {
    const first = localDateOf(range.startsAt, timeZone)
    const last = addDays(localDateOf(range.endsAt, timeZone), -1)
    return first === last ? `${br(first)}, dia inteiro` : `${br(first)} a ${br(last)}`
  }
  return `${dateTimeIn(range.startsAt, timeZone)} até ${dateTimeIn(range.endsAt, timeZone)}`
}

export const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  no_show: 'Faltou',
  canceled: 'Cancelado',
}

export const STATUS_VARIANTS: Record<
  AppointmentStatus,
  'secondary' | 'success' | 'warning' | 'outline'
> = {
  scheduled: 'secondary',
  completed: 'success',
  no_show: 'warning',
  canceled: 'outline',
}

/** Fusos comuns no Brasil (o atual da conta entra se não estiver aqui). */
export const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (São Paulo, Rio, Sul, Nordeste…)' },
  { value: 'America/Manaus', label: 'Amazonas (Manaus)' },
  { value: 'America/Cuiaba', label: 'Mato Grosso (Cuiabá)' },
  { value: 'America/Campo_Grande', label: 'Mato Grosso do Sul (Campo Grande)' },
  { value: 'America/Porto_Velho', label: 'Rondônia (Porto Velho)' },
  { value: 'America/Boa_Vista', label: 'Roraima (Boa Vista)' },
  { value: 'America/Rio_Branco', label: 'Acre (Rio Branco)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
] as const

/** Espelho de `SLOT_STEPS` do backend. */
export const SLOT_STEPS = [10, 15, 20, 30, 60] as const
