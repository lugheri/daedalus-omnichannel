import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { BookingSettings } from '../domain/booking-settings.entity';
import {
  BOOKING_SETTINGS_REPOSITORY,
  type BookingSettingsRepository,
} from './ports/booking-settings.repository';
import { BOOKING_KEY_GENERATOR, type BookingKeyGenerator } from './ports/scheduling-sources';

/**
 * As configurações da agenda da conta atual. Conta que nunca configurou usa
 * os padrões (sem gravar nada); a primeira gravação cria o registro, com a
 * chave do widget.
 */
@Injectable()
export class AgendaSettings {
  constructor(
    @Inject(BOOKING_SETTINGS_REPOSITORY) private readonly settings: BookingSettingsRepository,
    @Inject(BOOKING_KEY_GENERATOR) private readonly keys: BookingKeyGenerator,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async current(): Promise<BookingSettings> {
    return (
      (await this.settings.findCurrent()) ??
      BookingSettings.create(this.tenant.tenantId, this.keys.generate())
    );
  }
}
