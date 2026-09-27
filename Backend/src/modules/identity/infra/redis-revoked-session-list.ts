import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../shared/infra/redis/redis.module';
import type { RevokedSessionList } from '../application/ports/revoked-session-list';

const KEY = (sessionId: string) => `identity:revoked-session:${sessionId}`;

/**
 * Com o Redis fora, a consulta falha ABERTO (token aceito até expirar, como
 * antes desta lista existir) e a gravação é só logada: a sessão continua
 * revogada no banco, então o refresh token já não funciona.
 */
@Injectable()
export class RedisRevokedSessionList implements RevokedSessionList {
  private readonly logger = new Logger(RedisRevokedSessionList.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async add(sessionId: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(KEY(sessionId), '1', 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Não foi possível registrar a sessão revogada: ${String(error)}`);
    }
  }

  async has(sessionId: string): Promise<boolean> {
    try {
      return (await this.redis.exists(KEY(sessionId))) === 1;
    } catch (error) {
      this.logger.warn(`Lista de sessões revogadas indisponível: ${String(error)}`);
      return false;
    }
  }
}
