import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import { InvalidPhoneError } from './errors/invalid-phone.error';

/**
 * Value object: se existe um `Phone`, ele é válido e está em E.164.
 * Aceita a forma digitada (`(11) 98765-4321` assume +55) — ver normalizePhoneNumber.
 */
export class Phone {
  private constructor(readonly value: string) {}

  static create(raw: string): Phone {
    const normalized = normalizePhoneNumber(raw);
    if (!normalized) throw new InvalidPhoneError(raw);
    return new Phone(normalized);
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
