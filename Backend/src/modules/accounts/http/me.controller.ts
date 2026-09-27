import { Controller, Get, Inject } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import { GetMeUseCase } from '../application/use-cases/get-me/get-me.use-case';
import { TenantPresenter } from './tenant.presenter';

/** Qualquer membro autenticado pode ver os próprios dados — sem permissão específica. */
@Controller('v1/me')
export class MeController {
  constructor(
    private readonly getMe: GetMeUseCase,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  @Get()
  async me() {
    const { user, tenant, access } = await this.getMe.execute(this.actors.actor);
    return {
      user,
      tenant: TenantPresenter.toHttp(tenant),
      role: access.role,
      permissions: access.permissions,
    };
  }
}
