/**
 * API pública do módulo scheduling. Outros módulos só podem importar daqui.
 */
export { SchedulingFacade } from './application/scheduling.facade';
export { AppointmentBookedEvent } from './domain/events/appointment-booked.event';
export { SchedulingModule } from './scheduling.module';
