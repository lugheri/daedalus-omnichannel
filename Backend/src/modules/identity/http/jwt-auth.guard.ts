import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import { IS_PUBLIC } from '../../../shared/http/public.decorator';
import { AuthenticateAccessTokenUseCase } from '../application/use-cases/authenticate-access-token/authenticate-access-token.use-case';

/**
 * Guard GLOBAL (APP_GUARD): toda rota exige `Authorization: Bearer <token>`,
 * exceto as marcadas com @Public(). Autenticado, o ator (e com ele o tenant)
 * vai para o contexto da requisição, de onde os repositórios leem o tenant.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateAccessTokenUseCase,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { actor } = await this.authenticate.execute(bearerToken(request.headers.authorization));
    this.actors.authenticate(actor);
    return true;
  }
}

function bearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
