import { Controller, Get, Inject } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import { GetMeUseCase } from '../application/use-cases/get-me/get-me.use-case';
import { ListMyAccountsUseCase } from '../application/use-cases/my-accounts/my-accounts.use-cases';
import { TenantPresenter } from './tenant.presenter';

/** Qualquer membro autenticado pode ver os próprios dados — sem permissão específica. */
@Controller('v1/me')
export class MeController {
  constructor(
    private readonly getMe: GetMeUseCase,
    private readonly listMyAccounts: ListMyAccountsUseCase,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  @Get()
  async me() {
    const { user, tenant, access, parent, delegatedFrom } = await this.getMe.execute(
      this.actors.actor,
    );
    const brief = (t: typeof parent) => t && { id: t.id, name: t.name };
    return {
      user,
      tenant: TenantPresenter.toHttp(tenant),
      /** O vínculo do usuário nesta conta ("atribuída a mim", "Você" nas mensagens). */
      membershipId: access.membershipId,
      role: access.role,
      permissions: access.permissions,
      /** A conta-mãe (quem gerencia esta), se houver. */
      parent: brief(parent),
      /** Entrou vindo de uma conta acima: qual (o front mostra o aviso e "voltar"). */
      delegatedFrom: brief(delegatedFrom),
    };
  }

  /** As contas em que a pessoa pode entrar (seletor de conta; a troca é em /v1/auth/switch-account). */
  @Get('accounts')
  async accounts() {
    const tenants = await this.listMyAccounts.execute(this.actors.actor);
    return tenants.map((tenant) => TenantPresenter.toHttp(tenant));
  }
}
