import { randomBytes } from 'node:crypto';
import { SecretBox } from './secret-box';

describe('SecretBox', () => {
  const box = new SecretBox(randomBytes(32).toString('base64'));

  it('round-trips a secret', () => {
    expect(box.openText(box.seal('token-super-secreto'))).toBe('token-super-secreto');
  });

  it('never produces the same ciphertext twice (random IV)', () => {
    expect(box.seal('igual').equals(box.seal('igual'))).toBe(false);
  });

  it('detects tampering instead of returning garbage', () => {
    const sealed = box.seal('valor');
    sealed[sealed.length - 1] ^= 0xff;

    expect(() => box.open(sealed)).toThrow();
  });

  it('cannot be opened with another key', () => {
    const other = new SecretBox(randomBytes(32).toString('base64'));

    expect(() => other.open(box.seal('valor'))).toThrow();
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => new SecretBox(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
  });
});
