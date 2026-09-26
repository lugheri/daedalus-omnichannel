import { InvalidEmailError } from './errors/invalid-email.error';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Value object: se existe um `Email`, ele é válido e está normalizado. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL.test(normalized)) throw new InvalidEmailError(raw);
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
