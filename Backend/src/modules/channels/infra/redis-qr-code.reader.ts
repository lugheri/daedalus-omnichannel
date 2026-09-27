import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { whatsAppQrCodeKey } from '../../../contracts/whatsapp-connector.contract';
import { REDIS_CLIENT } from '../../../shared/infra/redis/redis.module';
import type { QrCodeReader } from '../application/ports/qr-code-reader';

/** Lê o QR code que o conector publica no Redis (chave definida no contrato). */
@Injectable()
export class RedisQrCodeReader implements QrCodeReader {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async read(channelId: string): Promise<string | null> {
    try {
      return await this.redis.get(whatsAppQrCodeKey(channelId));
    } catch {
      return null; // sem Redis, a tela só não mostra o QR agora
    }
  }
}
