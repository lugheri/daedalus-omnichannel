import type { TimeRange } from './weekly-hours';
import { zonedToUtc } from './zoned-time';

/** Período ocupado (agendamento ativo ou bloqueio). Meio-aberto: [start, end). */
export interface Busy {
  start: Date;
  end: Date;
}

export function overlaps(a: Busy, b: Busy): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Os horários em que um serviço de `durationMinutes` cabe inteiro numa das
 * faixas do dia, sem cruzar nada ocupado e não antes de `notBefore`. Os
 * inícios andam de `stepMinutes` em `stepMinutes`, a partir do começo de cada
 * faixa (faixa das 9h, passo de 30 min: 9h, 9h30, 10h…).
 */
export function freeSlots(input: {
  date: string;
  timeZone: string;
  ranges: readonly TimeRange[];
  busy: readonly Busy[];
  durationMinutes: number;
  stepMinutes: number;
  notBefore: Date;
}): Date[] {
  const slots: Date[] = [];
  for (const range of input.ranges) {
    for (let t = range.start; t + input.durationMinutes <= range.end; t += input.stepMinutes) {
      const start = zonedToUtc(input.date, t, input.timeZone);
      if (start < input.notBefore) continue;
      const slot = { start, end: new Date(start.getTime() + input.durationMinutes * 60_000) };
      if (input.busy.some((busy) => overlaps(busy, slot))) continue;
      slots.push(start);
    }
  }
  return slots;
}
