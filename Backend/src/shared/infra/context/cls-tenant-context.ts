import { Inject, Injectable } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../application/actor-context';
import type { TenantContext } from '../../application/tenant-context';

/** O tenant da operação é o do ator autenticado (vem do token, ADR 0002). */
@Injectable()
export class ClsTenantContext implements TenantContext {
  constructor(@Inject(ACTOR_CONTEXT) private readonly actors: ActorContext) {}

  get tenantId(): string {
    return this.actors.actor.tenantId;
  }
}
