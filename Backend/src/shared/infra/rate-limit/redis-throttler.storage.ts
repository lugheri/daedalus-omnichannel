import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Contador de janela fixa, atômico (script Lua): várias réplicas da API
 * compartilham o mesmo contador. Estourando o limite, a chave fica bloqueada
 * por `blockDuration`.
 *
 * Retorno: [totalHits, msAtéExpirarJanela, bloqueado(0/1), msAtéDesbloquear]
 */
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return { hits, redis.call('PTTL', KEYS[1]), 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, ttl, 1, tonumber(ARGV[3]) }
end
return { hits, ttl, 0, 0 }
`;

/**
 * Se o Redis estiver fora, FALHA ABERTO: a requisição passa sem limite e um
 * aviso é logado. Derrubar a API inteira por falta do contador seria pior
 * que ficar alguns instantes sem rate limit; o /health/ready denuncia a falha.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, name: string) {
    try {
      return await this.count(key, ttl, limit, blockDuration, name);
    } catch (error) {
      this.logger.warn(`Rate limit desativado: Redis indisponível (${String(error)})`);
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  private async count(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    name: string,
  ) {
    const prefix = `rate-limit:${name}:${key}`;
    const [totalHits, ttlMs, blocked, blockMs] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `${prefix}:hits`,
      `${prefix}:blocked`,
      ttl,
      limit,
      blockDuration || ttl,
    )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire: toSeconds(ttlMs),
      isBlocked: blocked === 1,
      timeToBlockExpire: toSeconds(blockMs),
    };
  }
}

function toSeconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}
