import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import type { HealthService } from './health.service';

/**
 * Servidor HTTP mínimo de health check para processos sem API (worker,
 * conector): o orquestrador (Swarm/Kubernetes) precisa saber se o processo
 * está vivo e pronto. Mesmas rotas e respostas da API: /health/live e /health/ready.
 */
export abstract class ProcessHealthServer implements OnApplicationBootstrap, OnApplicationShutdown {
  protected readonly logger = new Logger(this.constructor.name);
  private server?: Server;

  protected constructor(
    private readonly health: HealthService,
    private readonly host: string,
  ) {}

  protected abstract port(): number;

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

    this.server.listen(this.port(), this.host, () =>
      this.logger.log(`Health check em :${this.port()}/health`),
    );
  }

  onApplicationShutdown(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
