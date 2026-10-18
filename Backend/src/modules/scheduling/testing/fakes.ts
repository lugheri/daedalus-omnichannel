import type { TenantContext } from '../../../shared/application/tenant-context';
import type { AppointmentRepository } from '../application/ports/appointment.repository';
import type { BookingSettingsRepository } from '../application/ports/booking-settings.repository';
import type { ScheduleRepository } from '../application/ports/schedule.repository';
import type {
  AgendaProfessional,
  AgendaService,
  BookingKeyGenerator,
  SchedulingCatalog,
  SchedulingContacts,
  SchedulingMembers,
} from '../application/ports/scheduling-sources';
import type { TimeOffRepository } from '../application/ports/time-off.repository';
import { Appointment, type AppointmentStatus } from '../domain/appointment.entity';
import { BookingSettings } from '../domain/booking-settings.entity';
import { AppointmentConflictError } from '../domain/errors/appointment-conflict.error';
import type { TimeOff } from '../domain/time-off';
import type { WeeklyHours } from '../domain/weekly-hours';

const copy = (a: Appointment) =>
  Appointment.restore(a.id, {
    tenantId: a.tenantId,
    professionalId: a.professionalId,
    serviceId: a.serviceId,
    serviceName: a.serviceName,
    priceCents: a.priceCents,
    contactId: a.contactId,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    status: a.status,
    source: a.source,
    notes: a.notes,
    cancelReason: a.cancelReason,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });

/** Como o banco: dois ativos do mesmo profissional não se cruzam (EXCLUDE). */
export class InMemoryAppointmentRepository implements AppointmentRepository {
  items: Appointment[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private mine() {
    return this.items.filter((a) => a.tenantId === this.tenant.tenantId);
  }

  save(appointment: Appointment): Promise<void> {
    const clash = this.items.some(
      (a) =>
        a.id !== appointment.id &&
        appointment.status === 'scheduled' &&
        a.status === 'scheduled' &&
        a.professionalId === appointment.professionalId &&
        a.startsAt < appointment.endsAt &&
        appointment.startsAt < a.endsAt,
    );
    if (clash) return Promise.reject(new AppointmentConflictError());
    this.items = [...this.items.filter((a) => a.id !== appointment.id), copy(appointment)];
    return Promise.resolve();
  }

  findById(id: string): Promise<Appointment | null> {
    const found = this.mine().find((a) => a.id === id);
    return Promise.resolve(found ? copy(found) : null);
  }

  listBetween(query: {
    from: Date;
    to: Date;
    professionalIds?: string[];
    statuses?: AppointmentStatus[];
  }): Promise<Appointment[]> {
    return Promise.resolve(
      this.mine()
        .filter(
          (a) =>
            a.startsAt < query.to &&
            a.endsAt > query.from &&
            (!query.professionalIds || query.professionalIds.includes(a.professionalId)) &&
            (!query.statuses || query.statuses.includes(a.status)),
        )
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .map(copy),
    );
  }

  listByContact(contactId: string, limit: number): Promise<Appointment[]> {
    return Promise.resolve(
      this.mine()
        .filter((a) => a.contactId === contactId)
        .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
        .slice(0, limit)
        .map(copy),
    );
  }
}

export class InMemoryScheduleRepository implements ScheduleRepository {
  private readonly rows = new Map<string, { tenantId: string; weekly: WeeklyHours }>();

  constructor(private readonly tenant: TenantContext) {}

  findMany(professionalIds: string[]): Promise<Map<string, WeeklyHours>> {
    const result = new Map<string, WeeklyHours>();
    for (const id of professionalIds) {
      const row = this.rows.get(id);
      if (row && row.tenantId === this.tenant.tenantId) result.set(id, row.weekly);
    }
    return Promise.resolve(result);
  }

  save(professionalId: string, weekly: WeeklyHours): Promise<void> {
    this.rows.set(professionalId, { tenantId: this.tenant.tenantId, weekly });
    return Promise.resolve();
  }
}

export class InMemoryTimeOffRepository implements TimeOffRepository {
  items: TimeOff[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private mine() {
    return this.items.filter((t) => t.tenantId === this.tenant.tenantId);
  }

  save(timeOff: TimeOff): Promise<void> {
    this.items.push(timeOff);
    return Promise.resolve();
  }

  findById(id: string): Promise<TimeOff | null> {
    return Promise.resolve(this.mine().find((t) => t.id === id) ?? null);
  }

  delete(timeOff: TimeOff): Promise<void> {
    this.items = this.items.filter((t) => t.id !== timeOff.id);
    return Promise.resolve();
  }

  listBetween(query: { from: Date; to: Date; professionalIds?: string[] }): Promise<TimeOff[]> {
    return Promise.resolve(
      this.mine().filter(
        (t) =>
          t.startsAt < query.to &&
          t.endsAt > query.from &&
          (!query.professionalIds || query.professionalIds.includes(t.professionalId)),
      ),
    );
  }
}

export class InMemoryBookingSettingsRepository implements BookingSettingsRepository {
  items: BookingSettings[] = [];

  constructor(private readonly tenant: TenantContext) {}

  findCurrent(): Promise<BookingSettings | null> {
    return Promise.resolve(this.items.find((s) => s.tenantId === this.tenant.tenantId) ?? null);
  }

  save(settings: BookingSettings): Promise<void> {
    this.items = [...this.items.filter((s) => s.tenantId !== settings.tenantId), settings];
    return Promise.resolve();
  }

  findByPublicKeyAsSystem(publicKey: string): Promise<BookingSettings | null> {
    return Promise.resolve(this.items.find((s) => s.publicKey === publicKey) ?? null);
  }
}

/** Catálogo por tenant. */
export class FakeSchedulingCatalog implements SchedulingCatalog {
  readonly byTenant = new Map<
    string,
    { services: AgendaService[]; professionals: AgendaProfessional[] }
  >();

  constructor(private readonly tenant: TenantContext) {}

  load() {
    return Promise.resolve(
      this.byTenant.get(this.tenant.tenantId) ?? { services: [], professionals: [] },
    );
  }
}

export class FakeSchedulingContacts implements SchedulingContacts {
  readonly contacts: { id: string; name: string | null; phone: string | null }[] = [];
  readonly captured: { name: string; phone: string | null; email: string | null }[] = [];

  findByIds(ids: string[]) {
    return Promise.resolve(this.contacts.filter((c) => ids.includes(c.id)));
  }

  captureBookingLead(input: { name: string; phone: string | null; email: string | null }) {
    this.captured.push(input);
    const contact = { id: `lead-${this.captured.length}`, name: input.name, phone: input.phone };
    this.contacts.push(contact);
    return Promise.resolve({ contactId: contact.id });
  }
}

export class FakeSchedulingMembers implements SchedulingMembers {
  currentMembershipId() {
    return Promise.resolve('member-1');
  }
}

export class SequentialBookingKeys implements BookingKeyGenerator {
  private next = 1;

  generate(): string {
    return `agenda-${this.next++}`;
  }
}
