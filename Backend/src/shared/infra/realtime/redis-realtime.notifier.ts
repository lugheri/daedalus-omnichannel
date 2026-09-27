import { Inject, Injectable, Logger } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import type { Redis } from 'ioredis';
import type { RealtimeNotifier } from '../../application/realtime';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Emite pelo Redis no formato do `@socket.io/redis-adapter` — o adapter das
 * réplicas da API entrega às conexões nas salas. Funciona de qualquer
 * processo (api, worker), sem servidor Socket.IO local.
 */
@Injectable()
export class RedisRealtimeNotifier implements RealtimeNotifier {
  private readonly logger = new Logger(RedisRealtimeNotifier.name);
  private readonly emitter: Emitter;

  constructor(@Inject(REDIS_CLIENT) redis: Redis) {
    this.emitter = new Emitter(redis);
  }

  emit(rooms: readonly string[], event: string, data: Record<string, unknown>): Promise<void> {
    if (rooms.length === 0) return Promise.resolve();
    try {
      this.emitter.to([...rooms]).emit(event, data);
    } catch (error) {
      // Aviso perdido não é dado perdido: a tela se corrige no próximo refetch.
      this.logger.warn(`Aviso em tempo real não enviado (${event}): ${String(error)}`);
    }
    return Promise.resolve();
  }
}
