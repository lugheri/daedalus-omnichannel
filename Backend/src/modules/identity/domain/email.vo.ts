import { InvalidEmailError } from './errors/invalid-email.error';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail de login: normalizado em minúsculas, único na plataforma. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length > 320 || !EMAIL.test(normalized)) throw new InvalidEmailError(raw);
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
