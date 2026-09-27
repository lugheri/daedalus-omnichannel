import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { HealthService } from './health.service';
import { ProcessHealthServer } from './process-health.server';

/** Health check do processo `whatsapp-connector` (porta CONNECTOR_HEALTH_PORT). */
@Injectable()
export class ConnectorHealthServer extends ProcessHealthServer {
  constructor(
    health: HealthService,
    private readonly config: AppConfig,
  ) {
    super(health, config.host);
  }

  protected port(): number {
    return this.config.connectorHealthPort;
  }
}
