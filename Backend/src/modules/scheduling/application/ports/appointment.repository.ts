import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from '../../domain/appointment.entity';

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
  /**
   * Segura as marcações pelo site da conta atual até o fim da transação em
   * andamento (lock de transação no Postgres): duas marcações simultâneas
   * contam os limites uma depois da outra, sem as duas passarem. Só tem
   * efeito dentro de `UnitOfWork.run`.
   */
  lockOnlineBookings(): Promise<void>;
  /** Agendamentos do contato com esta origem, `scheduled` e começando depois de `after`. */
  countUpcoming(query: { contactId: string; source: AppointmentSource; after: Date }): Promise<number>;
  /** Criados com esta origem desde `since` (qualquer status). */
  countCreatedSince(query: { source: AppointmentSource; since: Date }): Promise<number>;
}

export const APPOINTMENT_REPOSITORY = Symbol('AppointmentRepository');
