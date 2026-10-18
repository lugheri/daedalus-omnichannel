import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidScheduleError } from './errors/invalid-schedule.error';
import { isValidTimeZone } from './zoned-time';

export const SLOT_STEPS = [10, 15, 20, 30, 60] as const;
const MAX_NOTICE_MINUTES = 7 * 24 * 60;
const MAX_DAYS_AHEAD = 180;

export interface BookingSettingsValues {
  enabled: boolean;
  /** Fuso da conta (IANA): o horário semanal dos profissionais está nele. */
  timezone: string;
  /** De quanto em quanto começam os horários oferecidos (minutos). */
  slotStepMinutes: number;
  /** Antecedência mínima para marcar pelo site (minutos). */
  minNoticeMinutes: number;
  /** Até quantos dias à frente o site mostra. */
  maxDaysAhead: number;
}

export interface BookingSettingsProps extends BookingSettingsValues {
  tenantId: string;
  /** Chave pública do widget de agendamento (vai no HTML do site). */
  publicKey: string;
  updatedAt: Date;
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettingsValues = {
  enabled: false,
  timezone: 'America/Sao_Paulo',
  slotStepMinutes: 30,
  minNoticeMinutes: 120,
  maxDaysAhead: 30,
};

/**
 * A agenda da conta: fuso e o agendamento online (desligado até a conta
 * ligar). Existe para toda conta — nasce com os padrões no primeiro uso.
 */
export class BookingSettings extends AggregateRoot<BookingSettingsProps> {
  static create(tenantId: string, publicKey: string): BookingSettings {
    return new BookingSettings(tenantId, {
      ...DEFAULT_BOOKING_SETTINGS,
      tenantId,
      publicKey,
      updatedAt: new Date(),
    });
  }

  static restore(props: BookingSettingsProps): BookingSettings {
    return new BookingSettings(props.tenantId, props);
  }

  update(changes: Partial<BookingSettingsValues>): void {
    const next = { ...this.values };
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) Object.assign(next, { [key]: value });
    }
    Object.assign(this.props, validValues(next));
    this.props.updatedAt = new Date();
  }

  /** Chave nova: o widget com a antiga para de funcionar. */
  rotateKey(publicKey: string): void {
    this.props.publicKey = publicKey;
    this.props.updatedAt = new Date();
  }

  get values(): BookingSettingsValues {
    const { enabled, timezone, slotStepMinutes, minNoticeMinutes, maxDaysAhead } = this.props;
    return { enabled, timezone, slotStepMinutes, minNoticeMinutes, maxDaysAhead };
  }
  get tenantId() {
    return this.props.tenantId;
  }
  get publicKey() {
    return this.props.publicKey;
  }
  get enabled() {
    return this.props.enabled;
  }
  get timezone() {
    return this.props.timezone;
  }
  get slotStepMinutes() {
    return this.props.slotStepMinutes;
  }
  get minNoticeMinutes() {
    return this.props.minNoticeMinutes;
  }
  get maxDaysAhead() {
    return this.props.maxDaysAhead;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}

function validValues(input: BookingSettingsValues): BookingSettingsValues {
  const ok =
    isValidTimeZone(input.timezone) &&
    (SLOT_STEPS as readonly number[]).includes(input.slotStepMinutes) &&
    Number.isInteger(input.minNoticeMinutes) &&
    input.minNoticeMinutes >= 0 &&
    input.minNoticeMinutes <= MAX_NOTICE_MINUTES &&
    Number.isInteger(input.maxDaysAhead) &&
    input.maxDaysAhead >= 1 &&
    input.maxDaysAhead <= MAX_DAYS_AHEAD;
  if (!ok) throw new InvalidScheduleError('AGENDA_INVALID_SETTINGS');
  return input;
}
