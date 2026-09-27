import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AppConfigModule } from '../../config/app-config.module';
import {
  WHATSAPP_CONNECTOR_QUEUE,
  WHATSAPP_EVENTS_QUEUE,
} from '../../contracts/whatsapp-connector.contract';
import { ConnectorHealthServer } from '../../health/connector-health.server';
import { HealthModule } from '../../health/health.module';
import { SecretBox } from '../../shared/infra/crypto/secret-box';
import { PrismaModule } from '../../shared/infra/prisma/prisma.module';
import { SharedInfraModule } from '../../shared/infra/shared-infra.module';
import { AuthStateStore, CONNECTOR_SECRET_BOX } from './auth-state.store';
import { ConnectorCommandsProcessor } from './connector-commands.processor';
import { ConnectorReporter } from './connector-reporter';
import { SessionLeases } from './session-leases';
import { SessionManager } from './session-manager';

/**
 * Processo `whatsapp-connector` (ADR 0006): mantém as conexões do Baileys.
 *
 * Não importa NENHUM módulo de negócio — só infraestrutura e o contrato.
 * Recebe comandos pela fila `whatsapp-connector` e relata tudo pela fila
 * `whatsapp-events`, que o worker consome (módulo channels).
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    SharedInfraModule,
    HealthModule,
    BullModule.registerQueue({ name: WHATSAPP_CONNECTOR_QUEUE }, { name: WHATSAPP_EVENTS_QUEUE }),
  ],
  providers: [
    {
      provide: CONNECTOR_SECRET_BOX,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => new SecretBox(config.encryptionKey),
    },
    AuthStateStore,
    SessionLeases,
    ConnectorReporter,
    SessionManager,
    ConnectorCommandsProcessor,
    ConnectorHealthServer,
  ],
})
export class WhatsAppConnectorModule {}
