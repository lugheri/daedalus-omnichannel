import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { IdGenerator } from '../../application/id-generator';

/**
 * UUIDv7 (RFC 9562): os 48 primeiros bits são o timestamp em milissegundos.
 * IDs gerados depois são maiores — ordenar por id é ordenar por criação,
 * o que torna índices e paginação por cursor mais eficientes que com UUIDv4.
 */
@Injectable()
export class UuidV7IdGenerator implements IdGenerator {
  generate(): string {
    const bytes = randomBytes(16);
    bytes.writeUIntBE(Date.now(), 0, 6);
    bytes[6] = (bytes[6] & 0x0f) | 0x70; // versão 7
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 9562

    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
