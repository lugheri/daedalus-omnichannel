import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { InvitationTokenGenerator } from '../application/ports/invitation-token-generator';

/** 256 bits aleatórios; SHA-256 basta para guardar um segredo com essa entropia. */
@Injectable()
export class CryptoInvitationTokenGenerator implements InvitationTokenGenerator {
  generate() {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
