import { InvalidScheduleError } from './errors/invalid-schedule.error';

/** Faixa de atendimento num dia, em minutos (540–720 = 9h às 12h). */
export interface TimeRange {
  start: number;
  end: number;
}

/** 7 listas de faixas: domingo (0) a sábado (6), no fuso da conta. */
export type WeeklyHours = TimeRange[][];

const MAX_RANGES_PER_DAY = 6;
const MINUTES_PER_DAY = 1440;

const morning = { start: 9 * 60, end: 12 * 60 };
const afternoon = { start: 13 * 60, end: 18 * 60 };

/**
 * Horário de quem ainda não configurou: seg a sex das 9h às 12h e das 13h às
 * 18h; sábado das 9h às 13h. A conta nova já consegue marcar no dia um.
 */
export const DEFAULT_WEEKLY_HOURS: WeeklyHours = [
  [],
  [morning, afternoon],
  [morning, afternoon],
  [morning, afternoon],
  [morning, afternoon],
  [morning, afternoon],
  [{ start: 9 * 60, end: 13 * 60 }],
];

/**
 * Horário semanal válido: 7 dias; em cada um, até 6 faixas dentro do dia, em
 * minutos múltiplos de 5, em ordem e sem se cruzar.
 */
export function validWeeklyHours(input: TimeRange[][]): WeeklyHours {
  if (input.length !== 7) throw new InvalidScheduleError('AGENDA_INVALID_HOURS');
  return input.map((day) => {
    if (day.length > MAX_RANGES_PER_DAY) throw new InvalidScheduleError('AGENDA_INVALID_HOURS');
    const ranges = [...day].sort((a, b) => a.start - b.start);
    ranges.forEach((range, i) => {
      const ok =
        Number.isInteger(range.start) &&
        Number.isInteger(range.end) &&
        range.start >= 0 &&
        range.end <= MINUTES_PER_DAY &&
        range.start < range.end &&
        range.start % 5 === 0 &&
        range.end % 5 === 0 &&
        (i === 0 || ranges[i - 1].end <= range.start);
      if (!ok) throw new InvalidScheduleError('AGENDA_INVALID_HOURS');
    });
    return ranges.map(({ start, end }) => ({ start, end }));
  });
}
