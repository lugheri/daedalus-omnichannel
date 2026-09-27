import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import { AppConfig } from '../config/app-config';
import { HealthService } from './health.service';

/**
 * O worker não expõe a API HTTP; só este servidor mínimo, para o
 * orquestrador (Swarm/Kubernetes) saber se o processo está vivo e pronto.
 * Mesmas rotas e respostas da API: /health/live e /health/ready.
 */
@Injectable()
export class WorkerHealthServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerHealthServer.name);
  private server?: Server;

  constructor(
    private readonly health: HealthService,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    this.server = createServer((req, res) => {
      const reply = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (req.url === '/health/live') return reply(200, { status: 'ok' });
      if (req.url === '/health/ready') {
        void this.health
          .readiness()
          .then(({ ready, checks }) =>
            reply(ready ? 200 : 503, { status: ready ? 'ok' : 'error', checks }),
          );
        return;
      }
      reply(404, { code: 'NOT_FOUND' });
    });

    this.server.listen(this.config.workerHealthPort, this.config.host, () =>
      this.logger.log(`Health check do worker em :${this.config.workerHealthPort}/health`),
    );
  }

  onApplicationShutdown(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
