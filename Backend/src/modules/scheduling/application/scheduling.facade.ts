import { Inject, Injectable } from '@nestjs/common';
import {
  BOOKING_SETTINGS_REPOSITORY,
  type BookingSettingsRepository,
} from './ports/booking-settings.repository';

/** API do módulo para outros módulos (o site mostra o agendamento online). */
@Injectable()
export class SchedulingFacade {
  constructor(
    @Inject(BOOKING_SETTINGS_REPOSITORY) private readonly settings: BookingSettingsRepository,
  ) {}

  /** A chave do widget de agendamento, se o agendamento online da conta atual estiver ligado. */
  async onlineBookingKey(): Promise<string | null> {
    const settings = await this.settings.findCurrent();
    return settings?.enabled ? settings.publicKey : null;
  }
}
