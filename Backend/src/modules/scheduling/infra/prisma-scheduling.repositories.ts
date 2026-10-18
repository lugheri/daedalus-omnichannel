import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { Prisma } from '../../../shared/infra/prisma/generated/client';
import type {
  AppointmentModel,
  BookingSettingsModel,
  TimeOffModel,
} from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { AppointmentRepository } from '../application/ports/appointment.repository';
import type { BookingSettingsRepository } from '../application/ports/booking-settings.repository';
import type { ScheduleRepository } from '../application/ports/schedule.repository';
import type { TimeOffRepository } from '../application/ports/time-off.repository';
import {
  Appointment,
  type AppointmentSource,
  type AppointmentStatus,
} from '../domain/appointment.entity';
import { BookingSettings } from '../domain/booking-settings.entity';
import { AppointmentConflictError } from '../domain/errors/appointment-conflict.error';
import type { TimeOff } from '../domain/time-off';
import type { WeeklyHours } from '../domain/weekly-hours';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A EXCLUDE da migration (`appointments_no_overlap`) barrou: horário cruzado. */
function isOverlap(error: unknown): boolean {
  const text = `${String(error)} ${JSON.stringify((error as { meta?: unknown })?.meta ?? {})}`;
  return text.includes('appointments_no_overlap') || text.includes('23P01');
}

@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(appointment: Appointment): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = {
      professionalId: appointment.professionalId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      notes: appointment.notes,
      cancelReason: appointment.cancelReason,
      updatedAt: appointment.updatedAt,
    };
    try {
      await this.db.appointment.upsert({
        where: { id: appointment.id, tenantId },
        create: {
          id: appointment.id,
          tenantId,
          ...data,
          serviceId: appointment.serviceId,
          serviceName: appointment.serviceName,
          priceCents: appointment.priceCents,
          contactId: appointment.contactId,
          source: appointment.source,
          createdBy: appointment.createdBy,
          createdAt: appointment.createdAt,
        },
        update: data,
      });
    } catch (error) {
      if (isOverlap(error)) throw new AppointmentConflictError();
      throw error;
    }
  }

  async findById(id: string): Promise<Appointment | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.appointment.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toAppointment(row) : null;
  }

  async listBetween(query: {
    from: Date;
    to: Date;
    professionalIds?: string[];
    statuses?: AppointmentStatus[];
  }): Promise<Appointment[]> {
    const rows = await this.db.appointment.findMany({
      where: {
        tenantId: this.tenant.tenantId,
        startsAt: { lt: query.to },
        endsAt: { gt: query.from },
        ...(query.professionalIds ? { professionalId: { in: query.professionalIds } } : {}),
        ...(query.statuses ? { status: { in: query.statuses } } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toAppointment);
  }

  async listByContact(contactId: string, limit: number): Promise<Appointment[]> {
    if (!UUID.test(contactId)) return [];
    const rows = await this.db.appointment.findMany({
      where: { tenantId: this.tenant.tenantId, contactId },
      orderBy: { startsAt: 'desc' },
      take: limit,
    });
    return rows.map(toAppointment);
  }
}

function toAppointment(row: AppointmentModel): Appointment {
  return Appointment.restore(row.id, {
    tenantId: row.tenantId,
    professionalId: row.professionalId,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    priceCents: row.priceCents,
    contactId: row.contactId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status as AppointmentStatus,
    source: row.source as AppointmentSource,
    notes: row.notes,
    cancelReason: row.cancelReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

@Injectable()
export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async findMany(professionalIds: string[]): Promise<Map<string, WeeklyHours>> {
    const ids = professionalIds.filter((id) => UUID.test(id));
    if (ids.length === 0) return new Map();
    const rows = await this.txHost.tx.professionalSchedule.findMany({
      where: { tenantId: this.tenant.tenantId, professionalId: { in: ids } },
    });
    return new Map(rows.map((r) => [r.professionalId, r.weekly as unknown as WeeklyHours]));
  }

  async save(professionalId: string, weekly: WeeklyHours): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = { weekly: weekly as unknown as Prisma.InputJsonValue, updatedAt: new Date() };
    await this.txHost.tx.professionalSchedule.upsert({
      where: { professionalId, tenantId },
      create: { professionalId, tenantId, ...data },
      update: data,
    });
  }
}

@Injectable()
export class PrismaTimeOffRepository implements TimeOffRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(timeOff: TimeOff): Promise<void> {
    await this.db.timeOff.create({ data: { ...timeOff, tenantId: this.tenant.tenantId } });
  }

  async findById(id: string): Promise<TimeOff | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.timeOff.findFirst({ where: { id, tenantId: this.tenant.tenantId } });
    return row ? toTimeOff(row) : null;
  }

  async delete(timeOff: TimeOff): Promise<void> {
    await this.db.timeOff.deleteMany({ where: { id: timeOff.id, tenantId: this.tenant.tenantId } });
  }

  async listBetween(query: {
    from: Date;
    to: Date;
    professionalIds?: string[];
  }): Promise<TimeOff[]> {
    const rows = await this.db.timeOff.findMany({
      where: {
        tenantId: this.tenant.tenantId,
        startsAt: { lt: query.to },
        endsAt: { gt: query.from },
        ...(query.professionalIds ? { professionalId: { in: query.professionalIds } } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toTimeOff);
  }
}

function toTimeOff(row: TimeOffModel): TimeOff {
  return {
    id: row.id,
    tenantId: row.tenantId,
    professionalId: row.professionalId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaBookingSettingsRepository implements BookingSettingsRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async findCurrent(): Promise<BookingSettings | null> {
    const row = await this.txHost.tx.bookingSettings.findUnique({
      where: { tenantId: this.tenant.tenantId },
    });
    return row ? toSettings(row) : null;
  }

  async save(settings: BookingSettings): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = {
      ...settings.values,
      publicKey: settings.publicKey,
      updatedAt: settings.updatedAt,
    };
    await this.txHost.tx.bookingSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  async findByPublicKeyAsSystem(publicKey: string): Promise<BookingSettings | null> {
    if (!publicKey || publicKey.length > 100) return null;
    // Sem filtro de tenant DE PROPÓSITO: a chave é o que diz a conta (ver o port).
    const row = await this.txHost.tx.bookingSettings.findUnique({ where: { publicKey } });
    return row ? toSettings(row) : null;
  }
}

function toSettings(row: BookingSettingsModel): BookingSettings {
  return BookingSettings.restore({
    tenantId: row.tenantId,
    publicKey: row.publicKey,
    enabled: row.enabled,
    timezone: row.timezone,
    slotStepMinutes: row.slotStepMinutes,
    minNoticeMinutes: row.minNoticeMinutes,
    maxDaysAhead: row.maxDaysAhead,
    updatedAt: row.updatedAt,
  });
}
