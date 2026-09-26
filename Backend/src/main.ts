import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { validateEnv } from './config/env.schema';

async function bootstrap() {
  // O adapter HTTP é criado antes do container de DI; por isso lê o env direto.
  const { TRUST_PROXY } = validateEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: TRUST_PROXY }),
  );
  const config = app.get(AppConfig);

  await app.register(fastifyCookie);
  // Só o frontend conhecido pode chamar a API pelo navegador, com cookies.
  app.enableCors({ origin: [...config.corsOrigins], credentials: true });
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
}

void bootstrap();
