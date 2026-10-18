import type { Appointment, AppointmentStatus } from '../../domain/appointment.entity';

/** Restrito ao tenant atual. */
export interface AppointmentRepository {
  /**
   * Cria ou grava. Lança `AppointmentConflictError` se o horário cruzar outro
   * agendamento ativo do mesmo profissional (garantido pelo banco).
   */
  save(appointment: Appointment): Promise<void>;
  findById(id: string): Promise<Appointment | null>;
  /** Os que cruzam [from, to), por início. Sem `statuses`: todos. */
  listBetween(query: {
    from: Date;
    to: Date;
    professionalIds?: string[];
    statuses?: AppointmentStatus[];
  }): Promise<Appointment[]>;
  /** Do contato, mais recentes primeiro. */
  listByContact(contactId: string, limit: number): Promise<Appointment[]>;
}

export const APPOINTMENT_REPOSITORY = Symbol('AppointmentRepository');
