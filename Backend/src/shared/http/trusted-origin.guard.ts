import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AppConfig } from '../../config/app-config';

/**
 * Proteção contra CSRF nas rotas autenticadas por COOKIE (refresh, logout,
 * login, cadastro). O navegador anexa o cookie sozinho, então um site
 * malicioso poderia disparar essas rotas em nome da vítima; o header
 * `Origin` — que o navegador envia e o JavaScript não consegue forjar —
 * denuncia de onde veio a requisição.
 *
 * Complementa o `SameSite=Strict` do cookie (defesa em profundidade).
 * Sem `Origin` (clientes que não são navegador, como curl) a requisição
 * passa: sem navegador não há cookie de vítima para abusar.
 */
@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<FastifyRequest>().headers.origin;
    if (!origin || this.config.corsOrigins.includes(origin)) return true;

    throw new ForbiddenException({
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'Request origin is not allowed',
    });
  }
}
