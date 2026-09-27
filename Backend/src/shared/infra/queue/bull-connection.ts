import type { ConnectionOptions } from 'bullmq';

/**
 * Opções de conexão do BullMQ a partir da REDIS_URL.
 *
 * O BullMQ usa conexões próprias (não o REDIS_CLIENT da aplicação): os
 * workers exigem `maxRetriesPerRequest: null`, porque ficam bloqueados
 * esperando jobs — o oposto do que queremos nas demais chamadas ao Redis.
 */
export function bullConnectionFrom(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}
