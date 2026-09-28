import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { validateEnv } from './config/env.schema';
import { requestIdFor, type WithHeaders } from './shared/infra/context/request-id';
import { RedisIoAdapter } from './shared/infra/realtime/redis-io.adapter';

/** Ponto de entrada do processo `api` (`node dist/main.js`). */
async function bootstrap() {
  // O adapter HTTP é criado antes do container de DI; por isso lê o env direto.
  const { TRUST_PROXY } = validateEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // O id da requisição do Fastify é o correlation id (X-Request-Id recebido
    // ou um novo): o mesmo usado pelo contexto (CLS), pelos logs e pelos jobs.
    new FastifyAdapter({
      trustProxy: TRUST_PROXY,
      genReqId: (req: WithHeaders) => requestIdFor(req),
    }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      void reply.header('x-request-id', request.id);
      done();
    });
  const config = app.get(AppConfig);

  await app.register(fastifyCookie);
  // Anexos: um arquivo por requisição, limitado durante o upload (nada acima vai para a memória).
  await app.register(fastifyMultipart, {
    limits: { files: 1, fields: 5, fileSize: config.mediaMaxBytes },
  });
  // Só o frontend conhecido pode chamar a API pelo navegador, com cookies.
  app.enableCors({
    origin: [...config.corsOrigins],
    credentials: true,
    // O @fastify/cors libera só GET/HEAD/POST por padrão.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    exposedHeaders: ['x-request-id'],
  });
  // WebSocket (Socket.IO) no mesmo servidor HTTP, com adapter Redis entre réplicas.
  app.useWebSocketAdapter(new RedisIoAdapter(app));
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
}

void bootstrap();
