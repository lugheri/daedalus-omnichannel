import { WeakPasswordError } from './errors/weak-password.error';

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Senha em texto puro, só em trânsito: existe o tempo de ser validada e
 * virar hash. Nunca é persistida nem logada.
 */
export class Password {
  private constructor(readonly value: string) {}

  static create(raw: string): Password {
    if (raw.length < MIN_LENGTH || raw.length > MAX_LENGTH) {
      throw new WeakPasswordError(MIN_LENGTH, MAX_LENGTH);
    }
    return new Password(raw);
  }

  toString(): string {
    return '[redacted]';
  }

  toJSON(): string {
    return '[redacted]';
  }
}
