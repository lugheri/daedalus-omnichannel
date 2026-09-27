import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { HealthService } from './health.service';
import { ProcessHealthServer } from './process-health.server';

/** Health check do processo `worker` (porta WORKER_HEALTH_PORT). */
@Injectable()
export class WorkerHealthServer extends ProcessHealthServer {
  constructor(
    health: HealthService,
    private readonly config: AppConfig,
  ) {
    super(health, config.host);
  }

  protected port(): number {
    return this.config.workerHealthPort;
  }
}
