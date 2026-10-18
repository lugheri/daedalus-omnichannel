import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidAppointmentError } from './errors/invalid-appointment.error';
import { AppointmentBookedEvent } from './events/appointment-booked.event';

export const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'no_show', 'canceled'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentSource = 'panel' | 'site';

/** Um atendimento não passa de um dia. */
const MAX_DURATION_MINUTES = 24 * 60;
const MAX_NOTES = 1000;

export interface AppointmentProps {
  tenantId: string;
  professionalId: string;
  serviceId: string;
  /** Copiado na hora de marcar: o histórico não depende do catálogo. */
  serviceName: string;
  priceCents: number | null;
  contactId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  cancelReason: string | null;
  /** Membro que marcou (null = pelo site). */
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Horário marcado com um profissional para um serviço. Ativo = `scheduled`:
 * só os ativos ocupam a agenda (o banco não deixa dois ativos do mesmo
 * profissional se cruzarem).
 */
export class Appointment extends AggregateRoot<AppointmentProps> {
  static book(
    id: string,
    input: {
      tenantId: string;
      professionalId: string;
      service: { id: string; name: string; priceCents: number | null; durationMinutes: number };
      contactId: string;
      startsAt: Date;
      source: AppointmentSource;
      notes: string | null;
      createdBy: string | null;
    },
  ): Appointment {
    const now = new Date();
    const appointment = new Appointment(id, {
      tenantId: input.tenantId,
      professionalId: input.professionalId,
      serviceId: input.service.id,
      serviceName: input.service.name,
      priceCents: input.service.priceCents,
      contactId: input.contactId,
      ...period(input.startsAt, input.service.durationMinutes),
      status: 'scheduled',
      source: input.source,
      notes: validNotes(input.notes),
      cancelReason: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    appointment.addEvent(
      new AppointmentBookedEvent(
        id,
        input.tenantId,
        input.contactId,
        input.professionalId,
        { id: input.service.id, name: input.service.name, priceCents: input.service.priceCents },
        input.startsAt.toISOString(),
        input.source,
      ),
    );
    return appointment;
  }

  static restore(id: string, props: AppointmentProps): Appointment {
    return new Appointment(id, props);
  }

  /** Remarcar (outro horário e/ou profissional), mantendo a duração. Só os ativos. */
  reschedule(changes: { startsAt?: Date; professionalId?: string }): void {
    if (this.props.status !== 'scheduled') {
      throw new InvalidAppointmentError('APPOINTMENT_INVALID_STATUS');
    }
    const minutes = (this.props.endsAt.getTime() - this.props.startsAt.getTime()) / 60_000;
    if (changes.startsAt) Object.assign(this.props, period(changes.startsAt, minutes));
    if (changes.professionalId) this.props.professionalId = changes.professionalId;
    this.props.updatedAt = new Date();
  }

  editNotes(notes: string | null): void {
    this.props.notes = validNotes(notes);
    this.props.updatedAt = new Date();
  }

  /**
   * Concluído, faltou, cancelado — ou de volta a marcado (desfazer). Voltar a
   * marcado pode esbarrar num horário que foi ocupado nesse meio tempo (409).
   */
  changeStatus(status: AppointmentStatus, reason: string | null = null): void {
    if (status === this.props.status) return;
    const fromActive = this.props.status === 'scheduled';
    if (!fromActive && status !== 'scheduled') {
      throw new InvalidAppointmentError('APPOINTMENT_INVALID_STATUS');
    }
    this.props.status = status;
    this.props.cancelReason = status === 'canceled' ? reason?.trim().slice(0, 300) || null : null;
    this.props.updatedAt = new Date();
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get professionalId() {
    return this.props.professionalId;
  }
  get serviceId() {
    return this.props.serviceId;
  }
  get serviceName() {
    return this.props.serviceName;
  }
  get priceCents() {
    return this.props.priceCents;
  }
  get contactId() {
    return this.props.contactId;
  }
  get startsAt() {
    return this.props.startsAt;
  }
  get endsAt() {
    return this.props.endsAt;
  }
  get status() {
    return this.props.status;
  }
  get source() {
    return this.props.source;
  }
  get notes() {
    return this.props.notes;
  }
  get cancelReason() {
    return this.props.cancelReason;
  }
  get createdBy() {
    return this.props.createdBy;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}

function period(startsAt: Date, minutes: number): { startsAt: Date; endsAt: Date } {
  if (Number.isNaN(startsAt.getTime()) || minutes <= 0 || minutes > MAX_DURATION_MINUTES) {
    throw new InvalidAppointmentError('APPOINTMENT_INVALID_TIME');
  }
  return { startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) };
}

function validNotes(notes: string | null): string | null {
  const text = notes?.trim() || null;
  if (text && text.length > MAX_NOTES)
    throw new InvalidAppointmentError('APPOINTMENT_INVALID_NOTES');
  return text;
}
