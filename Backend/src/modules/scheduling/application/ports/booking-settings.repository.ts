import type { BookingSettings } from '../../domain/booking-settings.entity';

export interface BookingSettingsRepository {
  /** A da conta atual (null = nunca configurada: valem os padrões). */
  findCurrent(): Promise<BookingSettings | null>;
  save(settings: BookingSettings): Promise<void>;
  /** Pela chave do widget, em QUALQUER conta (a chave diz a conta). */
  findByPublicKeyAsSystem(publicKey: string): Promise<BookingSettings | null>;
}

export const BOOKING_SETTINGS_REPOSITORY = Symbol('BookingSettingsRepository');
