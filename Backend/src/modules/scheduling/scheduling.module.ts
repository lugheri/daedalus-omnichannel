import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CatalogModule } from '../catalog';
import { ContactsModule } from '../contacts';
import { AgendaSettings } from './application/agenda-settings';
import { Availability } from './application/availability';
import { APPOINTMENT_REPOSITORY } from './application/ports/appointment.repository';
import { BOOKING_SETTINGS_REPOSITORY } from './application/ports/booking-settings.repository';
import { SCHEDULE_REPOSITORY } from './application/ports/schedule.repository';
import {
  BOOKING_KEY_GENERATOR,
  SCHEDULING_CATALOG,
  SCHEDULING_CONTACTS,
  SCHEDULING_MEMBERS,
} from './application/ports/scheduling-sources';
import { TIME_OFF_REPOSITORY } from './application/ports/time-off.repository';
import { SchedulingFacade } from './application/scheduling.facade';
import {
  AgendaFreeSlotsUseCase,
  BookAppointmentUseCase,
  ChangeAppointmentStatusUseCase,
  ContactAppointmentsUseCase,
  ListAgendaDayUseCase,
  UpdateAppointmentUseCase,
} from './application/use-cases/agenda.use-cases';
import {
  GetBookingPageUseCase,
  GetBookingSettingsUseCase,
  PublicBookUseCase,
  PublicSlotsUseCase,
  ResolveBookingKey,
  UpdateBookingSettingsUseCase,
} from './application/use-cases/booking.use-cases';
import {
  AddTimeOffUseCase,
  GetProfessionalScheduleUseCase,
  RemoveTimeOffUseCase,
  SetWeeklyHoursUseCase,
} from './application/use-cases/schedules.use-cases';
import { AgendaController } from './http/agenda.controller';
import { PublicBookingController } from './http/public-booking.controller';
import {
  AccountsSchedulingMembers,
  CatalogSchedulingCatalog,
  ContactsSchedulingContacts,
  RandomBookingKeyGenerator,
} from './infra/gateways';
import {
  PrismaAppointmentRepository,
  PrismaBookingSettingsRepository,
  PrismaScheduleRepository,
  PrismaTimeOffRepository,
} from './infra/prisma-scheduling.repositories';

/**
 * A agenda (ADR 0013): horário semanal e bloqueios dos profissionais (do
 * catalog), agendamentos com os contatos e o agendamento online pelo site.
 */
@Module({
  imports: [AccountsModule, CatalogModule, ContactsModule],
  controllers: [AgendaController, PublicBookingController],
  providers: [
    AgendaSettings,
    Availability,
    ListAgendaDayUseCase,
    AgendaFreeSlotsUseCase,
    BookAppointmentUseCase,
    UpdateAppointmentUseCase,
    ChangeAppointmentStatusUseCase,
    ContactAppointmentsUseCase,
    GetProfessionalScheduleUseCase,
    SetWeeklyHoursUseCase,
    AddTimeOffUseCase,
    RemoveTimeOffUseCase,
    GetBookingSettingsUseCase,
    UpdateBookingSettingsUseCase,
    ResolveBookingKey,
    GetBookingPageUseCase,
    PublicSlotsUseCase,
    PublicBookUseCase,
    SchedulingFacade,
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: SCHEDULE_REPOSITORY, useClass: PrismaScheduleRepository },
    { provide: TIME_OFF_REPOSITORY, useClass: PrismaTimeOffRepository },
    { provide: BOOKING_SETTINGS_REPOSITORY, useClass: PrismaBookingSettingsRepository },
    { provide: SCHEDULING_CATALOG, useClass: CatalogSchedulingCatalog },
    { provide: SCHEDULING_CONTACTS, useClass: ContactsSchedulingContacts },
    { provide: SCHEDULING_MEMBERS, useClass: AccountsSchedulingMembers },
    { provide: BOOKING_KEY_GENERATOR, useClass: RandomBookingKeyGenerator },
  ],
  exports: [SchedulingFacade],
})
export class SchedulingModule {}
