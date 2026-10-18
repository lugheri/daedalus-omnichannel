import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PublicKeyGenerator } from '../application/ports/public-key-generator';

@Injectable()
export class RandomPublicKeyGenerator implements PublicKeyGenerator {
  generate(): string {
    return randomBytes(18).toString('base64url');
  }
}
