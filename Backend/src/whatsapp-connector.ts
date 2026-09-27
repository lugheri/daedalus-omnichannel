import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WhatsAppConnectorModule } from './connectors/whatsapp/whatsapp-connector.module';

/**
 * Ponto de entrada do processo `whatsapp-connector` (`node dist/whatsapp-connector.js`).
 * Mesma imagem da API e do worker; mantém as conexões do WhatsApp via Baileys (ADR 0006).
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WhatsAppConnectorModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // SIGTERM: encerra as conexões SEM logout e libera os leases, para outra
  // instância reassumir as sessões em seguida.
  app.enableShutdownHooks();
}

void bootstrap();
