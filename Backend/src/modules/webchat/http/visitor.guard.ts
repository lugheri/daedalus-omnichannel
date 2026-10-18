import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Visitor } from '../application/ports/visitor-tokens';
import { AuthenticateVisitorUseCase } from '../application/web-chat.use-cases';

/** O visitante que o token autenticou (o guard põe na requisição). */
export type VisitorRequest = FastifyRequest & { visitor?: Visitor };

/**
 * Rotas do visitante: token no `Authorization: Bearer` (o widget guarda no
 * navegador; nada de cookie, o site é de outro domínio). Fixa o tenant do
 * canal. Sem token válido: 401 `WEB_CHAT_INVALID_TOKEN`.
 */
@Injectable()
export class VisitorGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateVisitorUseCase) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<VisitorRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
    request.visitor = this.authenticate.execute(token);
    return true;
  }
}
