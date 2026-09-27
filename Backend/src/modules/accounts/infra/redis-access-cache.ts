import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../shared/infra/redis/redis.module';
import type { AccountAccess } from '../application/account-access';
import type { AccessCache } from '../application/ports/access-cache';

const TTL_SECONDS = 60;
const KEY = (membershipId: string) => `accounts:access:${membershipId}`;

/**
 * Com o Redis fora, o cache simplesmente não é usado: o acesso é resolvido
 * no banco a cada requisição (mais lento, mas sempre correto). Nunca falha
 * aberto aqui — sem cache não significa sem checagem.
 */
@Injectable()
export class RedisAccessCache implements AccessCache {
  private readonly logger = new Logger(RedisAccessCache.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(membershipId: string): Promise<AccountAccess | null> {
    try {
      const raw = await this.redis.get(KEY(membershipId));
      return raw ? (JSON.parse(raw) as AccountAccess) : null;
    } catch (error) {
      this.logger.warn(`Cache de acesso indisponível: ${String(error)}`);
      return null;
    }
  }

  async set(access: AccountAccess): Promise<void> {
    try {
      await this.redis.set(KEY(access.membershipId), JSON.stringify(access), 'EX', TTL_SECONDS);
    } catch {
      // sem cache: a próxima requisição consulta o banco de novo
    }
  }

  async invalidate(membershipIds: string[]): Promise<void> {
    if (membershipIds.length === 0) return;
    try {
      await this.redis.del(...membershipIds.map(KEY));
    } catch (error) {
      // O TTL curto limita a janela em que um acesso antigo ainda vale.
      this.logger.warn(`Não foi possível invalidar o cache de acesso: ${String(error)}`);
    }
  }
}
