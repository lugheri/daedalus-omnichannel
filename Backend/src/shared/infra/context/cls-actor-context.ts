import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Actor, ActorContext } from '../../application/actor-context';
import { TenantNotResolvedError } from '../../application/tenant-context';
import type { AppClsStore } from './app-cls-store';

@Injectable()
export class ClsActorContext implements ActorContext {
  constructor(private readonly cls: ClsService<AppClsStore>) {}

  get actor(): Actor {
    const actor = this.cls.get('actor');
    if (!actor) throw new TenantNotResolvedError();
    return actor;
  }

  authenticate(actor: Actor): void {
    this.cls.set('actor', actor);
  }
}
