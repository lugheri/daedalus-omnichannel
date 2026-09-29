import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ApiKeySecretGenerator } from '../application/ports/api-key-secret-generator';

/** 256 bits aleatórios; SHA-256 basta para guardar um segredo com essa entropia. */
@Injectable()
export class CryptoApiKeySecretGenerator implements ApiKeySecretGenerator {
  generate() {
    const secret = randomBytes(32).toString('base64url');
    return { secret, hash: this.hash(secret) };
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  matches(secret: string, hash: string): boolean {
    const actual = Buffer.from(this.hash(secret), 'hex');
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
