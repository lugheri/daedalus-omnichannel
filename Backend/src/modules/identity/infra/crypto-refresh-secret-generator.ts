import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { RefreshSecretGenerator } from '../application/ports/refresh-secret-generator';

/**
 * 256 bits aleatórios. Para um segredo com essa entropia, SHA-256 basta —
 * hash lento (Argon2) serve para senhas, que são adivinháveis.
 */
@Injectable()
export class CryptoRefreshSecretGenerator implements RefreshSecretGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
