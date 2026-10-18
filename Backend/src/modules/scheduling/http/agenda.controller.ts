import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  AgendaFreeSlotsUseCase,
  BookAppointmentUseCase,
  ChangeAppointmentStatusUseCase,
  ContactAppointmentsUseCase,
  ListAgendaDayUseCase,
  UpdateAppointmentUseCase,
} from '../application/use-cases/agenda.use-cases';
import {
  GetBookingSettingsUseCase,
  UpdateBookingSettingsUseCase,
} from '../application/use-cases/booking.use-cases';
import {
  AddTimeOffUseCase,
  GetProfessionalScheduleUseCase,
  RemoveTimeOffUseCase,
  SetWeeklyHoursUseCase,
} from '../application/use-cases/schedules.use-cases';
import type { Appointment } from '../domain/appointment.entity';
import type { BookingSettings } from '../domain/booking-settings.entity';
import type { TimeOff } from '../domain/time-off';
import {
  appointmentSchema,
  bookingSettingsSchema,
  dateQuery,
  slotsQuery,
  statusSchema,
  timeOffSchema,
  updateAppointmentSchema,
  weeklyHoursSchema,
} from './dto/agenda.dto';

const idParam = new ZodValidationPipe(z.uuid());

export const presentAppointment = (a: Appointment) => ({
  id: a.id,
  professionalId: a.professionalId,
  serviceId: a.serviceId,
  serviceName: a.serviceName,
  priceCents: a.priceCents,
  contactId: a.contactId,
  startsAt: a.startsAt.toISOString(),
  endsAt: a.endsAt.toISOString(),
  status: a.status,
  source: a.source,
  notes: a.notes,
  cancelReason: a.cancelReason,
  createdAt: a.createdAt.toISOString(),
});

const presentTimeOff = (t: TimeOff) => ({
  id: t.id,
  professionalId: t.professionalId,
  startsAt: t.startsAt.toISOString(),
  endsAt: t.endsAt.toISOString(),
  reason: t.reason,
});

const presentSettings = (s: BookingSettings) => ({ ...s.values, publicKey: s.publicKey });

/**
 * A agenda (ADR 0013). Ver e marcar: `agenda:manage`. Horário dos
 * profissionais e agendamento online: `catalog:manage` (quem configura o
 * catálogo).
 */
@Controller('v1/agenda')
export class AgendaController {
  constructor(
    private readonly listDay: ListAgendaDayUseCase,
    private readonly freeSlots: AgendaFreeSlotsUseCase,
    private readonly book: BookAppointmentUseCase,
    private readonly update: UpdateAppointmentUseCase,
    private readonly changeStatus: ChangeAppointmentStatusUseCase,
    private readonly byContact: ContactAppointmentsUseCase,
    private readonly getSchedule: GetProfessionalScheduleUseCase,
    private readonly setWeekly: SetWeeklyHoursUseCase,
    private readonly addTimeOff: AddTimeOffUseCase,
    private readonly removeTimeOff: RemoveTimeOffUseCase,
    private readonly getSettings: GetBookingSettingsUseCase,
    private readonly updateSettings: UpdateBookingSettingsUseCase,
  ) {}

  /** O dia: profissionais (com o horário do dia), serviços, agendamentos e bloqueios. */
  @RequirePermissions('agenda:manage')
  @Get('day')
  async day(@Query(new ZodValidationPipe(dateQuery)) query: z.infer<typeof dateQuery>) {
    const day = await this.listDay.execute(query.date);
    return {
      date: day.date,
      timezone: day.timezone,
      professionals: day.professionals,
      services: day.services,
      appointments: day.appointments.map((a) => ({
        ...presentAppointment(a),
        contact: {
          id: a.contactId,
          ...(day.contacts.get(a.contactId) ?? { name: null, phone: null }),
        },
      })),
      timeOffs: day.timeOffs.map(presentTimeOff),
    };
  }

  /** Horários livres para sugerir ao marcar (a partir de agora). */
  @RequirePermissions('agenda:manage')
  @Get('slots')
  async slots(@Query(new ZodValidationPipe(slotsQuery)) query: z.infer<typeof slotsQuery>) {
    return (await this.freeSlots.execute(query)).map((s) => ({
      startsAt: s.startsAt.toISOString(),
      professionalIds: s.professionalIds,
    }));
  }

  @RequirePermissions('agenda:manage')
  @Post('appointments')
  async create(
    @Body(new ZodValidationPipe(appointmentSchema)) body: z.infer<typeof appointmentSchema>,
  ) {
    return presentAppointment(await this.book.execute(body));
  }

  @RequirePermissions('agenda:manage')
  @Patch('appointments/:id')
  async edit(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema))
    body: z.infer<typeof updateAppointmentSchema>,
  ) {
    return presentAppointment(await this.update.execute(id, body));
  }

  /** Concluído, faltou, cancelado (com motivo) ou de volta a marcado. */
  @RequirePermissions('agenda:manage')
  @Post('appointments/:id/status')
  @HttpCode(HttpStatus.OK)
  async status(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>,
  ) {
    return presentAppointment(await this.changeStatus.execute(id, body.status, body.reason));
  }

  /** Agendamentos de um contato (ficha). */
  @RequirePermissions('agenda:manage')
  @Get('contacts/:id/appointments')
  async contactAppointments(@Param('id', idParam) contactId: string) {
    return (await this.byContact.execute(contactId)).map(presentAppointment);
  }

  @RequirePermissions('catalog:manage')
  @Get('professionals/:id/schedule')
  async schedule(@Param('id', idParam) professionalId: string) {
    const [{ weekly, isDefault, timeOffs }, { settings }] = await Promise.all([
      this.getSchedule.execute(professionalId),
      this.getSettings.execute(),
    ]);
    // O fuso: os horários (minutos do dia) e os bloqueios são no relógio da agenda.
    return {
      weekly,
      isDefault,
      timezone: settings.timezone,
      timeOffs: timeOffs.map(presentTimeOff),
    };
  }

  @RequirePermissions('catalog:manage')
  @Put('professionals/:id/schedule')
  async saveSchedule(
    @Param('id', idParam) professionalId: string,
    @Body(new ZodValidationPipe(weeklyHoursSchema)) body: z.infer<typeof weeklyHoursSchema>,
  ) {
    return { weekly: await this.setWeekly.execute(professionalId, body.weekly) };
  }

  @RequirePermissions('catalog:manage')
  @Post('professionals/:id/time-offs')
  async createTimeOff(
    @Param('id', idParam) professionalId: string,
    @Body(new ZodValidationPipe(timeOffSchema)) body: z.infer<typeof timeOffSchema>,
  ) {
    return presentTimeOff(await this.addTimeOff.execute({ professionalId, ...body }));
  }

  @RequirePermissions('catalog:manage')
  @Delete('time-offs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTimeOff(@Param('id', idParam) id: string) {
    await this.removeTimeOff.execute(id);
  }

  /** Fuso e agendamento online (a chave é a do widget no site). */
  @RequirePermissions('agenda:manage')
  @Get('settings')
  async settings() {
    const { settings, saved } = await this.getSettings.execute();
    // Nunca gravada: a chave ainda não existe (nasce na primeira gravação).
    return { ...presentSettings(settings), publicKey: saved ? settings.publicKey : null };
  }

  @RequirePermissions('catalog:manage')
  @Patch('settings')
  async saveSettings(
    @Body(new ZodValidationPipe(bookingSettingsSchema)) body: z.infer<typeof bookingSettingsSchema>,
  ) {
    return presentSettings(await this.updateSettings.execute(body));
  }
}
