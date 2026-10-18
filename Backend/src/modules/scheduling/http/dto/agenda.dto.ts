import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../../domain/appointment.entity';

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const range = z.object({ start: z.number().int(), end: z.number().int() });

export const dateQuery = z.object({ date: localDate });

export const slotsQuery = z.object({
  serviceId: z.uuid(),
  professionalId: z.uuid().nullable().default(null),
  date: localDate,
});

export const appointmentSchema = z.object({
  professionalId: z.uuid(),
  serviceId: z.uuid(),
  contactId: z.uuid(),
  startsAt: instant,
  notes: z.string().max(2000).nullable().default(null),
});

export const updateAppointmentSchema = z.object({
  startsAt: instant.optional(),
  professionalId: z.uuid().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const statusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  reason: z.string().max(500).nullable().default(null),
});

export const weeklyHoursSchema = z.object({
  weekly: z.array(z.array(range).max(12)).length(7),
});

export const timeOffSchema = z.object({
  startsAt: instant,
  endsAt: instant,
  reason: z.string().max(300).nullable().default(null),
});

export const bookingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
  slotStepMinutes: z.number().int().optional(),
  minNoticeMinutes: z.number().int().optional(),
  maxDaysAhead: z.number().int().optional(),
  rotateKey: z.boolean().optional(),
});

export const publicSlotsQuery = z.object({
  serviceId: z.uuid(),
  professionalId: z
    .uuid()
    .optional()
    .transform((value) => value ?? null),
  date: localDate,
});

export const publicBookingSchema = z.object({
  serviceId: z.uuid(),
  professionalId: z.uuid().nullable().default(null),
  startsAt: instant,
  name: z.string().max(200),
  phone: z.string().max(40).nullable().default(null),
  email: z.string().max(320).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
  /** Campo isca: preenchido = robô (finge sucesso e descarta). */
  website: z.string().max(500).optional(),
});
