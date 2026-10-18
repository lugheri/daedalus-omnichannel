/**
 * Datas locais no fuso da conta (IANA, ex.: America/Sao_Paulo), só com o
 * `Intl` do runtime. Uma "data local" é 'AAAA-MM-DD'; um horário do dia é em
 * minutos (0 = meia-noite). Instantes são `Date` (UTC).
 */

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parts(instant: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const get = (type: string) => Number(values.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Diferença do fuso para o UTC naquele instante, em minutos (São Paulo = -180). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = parts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** O instante de uma data local + minutos do dia, no fuso. */
export function zonedToUtc(date: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = offsetMinutes(new Date(guess), timeZone);
  const candidate = guess - first * 60_000;
  // Perto de uma troca de horário de verão o offset do resultado pode ser outro.
  const second = offsetMinutes(new Date(candidate), timeZone);
  return new Date(second === first ? candidate : guess - second * 60_000);
}

/** A data local de um instante no fuso. */
export function localDateOf(instant: Date, timeZone: string): string {
  const p = parts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Os minutos do dia de um instante no fuso. */
export function localMinutesOf(instant: Date, timeZone: string): number {
  const p = parts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
