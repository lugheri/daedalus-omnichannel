import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import { IS_PUBLIC } from '../../../shared/http/public.decorator';
import { hasAnyPermission, missingPermissions } from '../application/account-access';
import { ResolveAccessUseCase } from '../application/use-cases/resolve-access/resolve-access.use-case';
import { MissingPermissionError } from '../domain/errors/missing-permission.error';
import type { Permission } from '../domain/permissions';
import { REQUIRED_ANY_PERMISSION, REQUIRED_PERMISSIONS } from './require-permissions.decorator';

/**
 * Guard GLOBAL (APP_GUARD), executado depois do JwtAuthGuard em toda rota
 * autenticada:
 *   1. o vínculo do token segue ativo e a conta não está suspensa (senão 401);
 *   2. o cargo tem as permissões exigidas pela rota (senão 403).
 * Rotas sem @RequirePermissions só passam pela etapa 1.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolveAccess: ResolveAccessUseCase,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const access = await this.resolveAccess.execute(this.actors.actor);

    const all = this.reflector.getAllAndMerge<Permission[]>(REQUIRED_PERMISSIONS, targets);
    const missing = missingPermissions(access, all);
    if (missing.length > 0) throw MissingPermissionError.missing(missing);

    const any = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_ANY_PERMISSION,
      targets,
    );
    if (any && !hasAnyPermission(access, any)) throw MissingPermissionError.noneOf(any);

    return true;
  }
}
