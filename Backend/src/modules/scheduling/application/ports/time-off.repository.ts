import type { TimeOff } from '../../domain/time-off';

/** Restrito ao tenant atual. */
export interface TimeOffRepository {
  save(timeOff: TimeOff): Promise<void>;
  findById(id: string): Promise<TimeOff | null>;
  delete(timeOff: TimeOff): Promise<void>;
  /** Os que cruzam [from, to), por início. */
  listBetween(query: { from: Date; to: Date; professionalIds?: string[] }): Promise<TimeOff[]>;
}

export const TIME_OFF_REPOSITORY = Symbol('TimeOffRepository');
