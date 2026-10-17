import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../../../config/app-config';

export const REDIS_CLIENT = Symbol('RedisClient');

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    // Sem conexão pronta (Redis fora, ou desligando antes de conectar), o
    // `quit` falha na hora (sem fila offline) e o cliente seguiria tentando
    // reconectar, segurando o processo: aí só desconecta.
    if (this.redis.status !== 'ready') {
      this.redis.disconnect();
      return;
    }
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}

/**
 * Cliente Redis compartilhado. A conexão é assíncrona e se refaz sozinha:
 * a API sobe mesmo com o Redis fora, e o /health/ready denuncia o problema.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        // Comandos falham rápido quando o Redis está fora, em vez de enfileirar.
        const redis = new Redis(config.redisUrl, {
          maxRetriesPerRequest: 1,
          commandTimeout: 500,
          enableOfflineQueue: false,
        });
        // Sem listener, o ioredis despeja cada falha de reconexão no console.
        redis.on('error', () => undefined);
        return redis;
      },
    },
    RedisShutdown,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
