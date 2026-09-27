import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { AppConfig } from '../../../config/app-config';

/**
 * Socket.IO com adapter Redis: com várias réplicas da API, um aviso emitido
 * em qualquer lugar (outra réplica, o worker) chega a todas as conexões da
 * sala, onde quer que estejam. O pub/sub usa conexões próprias (uma conexão
 * em modo subscribe não executa outros comandos).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly corsOrigins: string[];

  constructor(app: INestApplicationContext) {
    super(app);
    const config = app.get(AppConfig);
    this.pub = new Redis(config.redisUrl, { lazyConnect: false });
    this.sub = this.pub.duplicate();
    // Sem listener, o ioredis despeja cada falha de reconexão no console.
    this.pub.on('error', () => undefined);
    this.sub.on('error', () => undefined);
    this.corsOrigins = [...config.corsOrigins];
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins },
      // Só WebSocket: sem long-polling não há "sticky session" a configurar no proxy.
      transports: ['websocket'],
      // O IoAdapter declara ServerOptions completo, mas o Socket.IO aceita parcial.
    } as ServerOptions);
    server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  override async dispose(): Promise<void> {
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
  }
}
