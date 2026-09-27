import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../../shared/infra/redis/redis.module';

const LEASE_TTL_MS = 30_000;
const key = (channelId: string) => `whatsapp:lease:${channelId}`;

/** Renova só se o lease ainda for desta instância (atômico). */
const RENEW = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0`;

/** Libera só se o lease ainda for desta instância (atômico). */
const RELEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

/**
 * Posse das sessões entre instâncias do conector (ADR 0006): cada número tem
 * no máximo UMA conexão viva. Quem conecta um número guarda um lease no Redis
 * e o renova periodicamente; se a instância morrer, o lease expira (30 s) e
 * outra instância assume. Isso também protege o deploy com sobreposição
 * (instância nova subindo antes da antiga sair).
 */
@Injectable()
export class SessionLeases {
  /** Identifica esta instância (aparece no Redis como dona do lease). */
  readonly instanceId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async acquire(channelId: string): Promise<boolean> {
    const result = await this.redis.set(key(channelId), this.instanceId, 'PX', LEASE_TTL_MS, 'NX');
    return result === 'OK';
  }

  async renew(channelId: string): Promise<boolean> {
    const result = await this.redis.eval(RENEW, 1, key(channelId), this.instanceId, LEASE_TTL_MS);
    return result === 1;
  }

  /** Alguma OUTRA instância tem a sessão deste canal? */
  async heldElsewhere(channelId: string): Promise<boolean> {
    const owner = await this.redis.get(key(channelId));
    return owner !== null && owner !== this.instanceId;
  }

  async release(channelId: string): Promise<void> {
    await this.redis.eval(RELEASE, 1, key(channelId), this.instanceId);
  }
}
