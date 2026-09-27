import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/**
 * Ponto de entrada do processo `worker` (`node dist/worker.js`).
 * Mesma imagem da API, escalado separadamente.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // SIGTERM (deploy/scale down): para de pegar jobs novos, termina os em
  // andamento e fecha conexões antes de sair.
  app.enableShutdownHooks();
}

void bootstrap();
