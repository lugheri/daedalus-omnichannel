import { InvalidPhoneError } from './errors/invalid-phone.error';

/** Formato E.164 (+ código do país + número), usado por WhatsApp e afins. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** Value object: se existe um `Phone`, ele é válido e está normalizado. */
export class Phone {
  private constructor(readonly value: string) {}

  static create(raw: string): Phone {
    const normalized = raw.replace(/[\s().-]/g, '');
    if (!E164.test(normalized)) throw new InvalidPhoneError(raw);
    return new Phone(normalized);
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
