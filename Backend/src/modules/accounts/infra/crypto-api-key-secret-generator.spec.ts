import { CryptoApiKeySecretGenerator } from './crypto-api-key-secret-generator';

describe('CryptoApiKeySecretGenerator', () => {
  const generator = new CryptoApiKeySecretGenerator();

  it('generates 256-bit secrets and matches only the right one', () => {
    const { secret, hash } = generator.generate();
    expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.matches(secret, hash)).toBe(true);
    expect(generator.matches(`${secret}x`, hash)).toBe(false);
    expect(generator.generate().secret).not.toBe(secret);
  });

  it('never throws on a malformed stored hash', () => {
    expect(generator.matches('qualquer', 'nao-e-hex')).toBe(false);
  });
});
