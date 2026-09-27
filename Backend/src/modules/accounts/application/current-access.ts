import { Inject, Injectable } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import type { AccountAccess } from './account-access';
import { ResolveAccessUseCase } from './use-cases/resolve-access/resolve-access.use-case';

/**
 * O acesso do ator da requisição atual (tenant, vínculo, cargo, permissões).
 * Use cases de gestão partem daqui: o tenant sobre o qual agem é SEMPRE o
 * do ator — nunca um id vindo do cliente.
 */
@Injectable()
export class CurrentAccess {
  constructor(
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    private readonly resolveAccess: ResolveAccessUseCase,
  ) {}

  get(): Promise<AccountAccess> {
    return this.resolveAccess.execute(this.actors.actor);
  }
}
