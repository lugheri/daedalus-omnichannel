import { Password } from '../domain/password.vo';
import { CryptoTemporaryPasswordGenerator } from './crypto-temporary-password-generator';

describe('CryptoTemporaryPasswordGenerator', () => {
  const generator = new CryptoTemporaryPasswordGenerator();

  it('generates 20 unambiguous characters that pass the password rules', () => {
    const password = generator.generate();

    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{20}$/);
    expect(() => Password.create(password)).not.toThrow();
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generator.generate()));
    expect(seen.size).toBe(200);
  });
});
