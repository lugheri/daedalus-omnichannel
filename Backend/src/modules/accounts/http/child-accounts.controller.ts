import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { z } from 'zod';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import {
  CreateChildAccountUseCase,
  ListChildAccountsUseCase,
  ListParentAccessesUseCase,
  SetChildAccountStatusUseCase,
} from '../application/use-cases/child-accounts/child-accounts.use-cases';
import { SetChildAccountPlanUseCase } from '../application/use-cases/plans/plans.use-cases';
import { RequirePermissions } from './require-permissions.decorator';
import { TenantPresenter } from './tenant.presenter';

const idParam = new ZodValidationPipe(z.uuid());
const createSchema = z.object({
  accountName: z.string().max(200),
  ownerEmail: z.string().max(320),
  /** Revendedor: a conta nova pode criar contas abaixo dela. */
  allowsChildren: z.boolean().default(false),
  /** Plano da conta nova (null = o padrão). */
  planId: z.uuid().nullable().default(null),
});
const updateSchema = z.object({ allowsChildren: z.boolean() });
const planSchema = z.object({ planId: z.uuid().nullable() });

/**
 * Hierarquia de contas (ADR 0009). Contas filhas: `accounts:children`. Entrar
 * numa delas é a troca de conta normal (`POST /v1/auth/switch-account`).
 */
@Controller('v1/accounts')
export class ChildAccountsController {
  constructor(
    private readonly listChildren: ListChildAccountsUseCase,
    private readonly createChild: CreateChildAccountUseCase,
    private readonly setStatus: SetChildAccountStatusUseCase,
    private readonly parentAccesses: ListParentAccessesUseCase,
    private readonly setPlan: SetChildAccountPlanUseCase,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  /** Todas as contas abaixo da atual (filhas, netas...). */
  @RequirePermissions('accounts:children')
  @Get('children')
  async children() {
    return (await this.listChildren.execute(this.actors.actor)).map(
      ({ tenant, parentName, depth, planName }) => ({
        ...TenantPresenter.toHttp(tenant),
        parentId: tenant.parentId,
        parentName,
        depth,
        planId: tenant.planId,
        planName,
        createdAt: tenant.createdAt.toISOString(),
      }),
    );
  }

  /** Conta filha nova + convite do dono (o link volta para repassar). */
  @RequirePermissions('accounts:children')
  @Post('children')
  async create(@Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>) {
    const { tenant, inviteUrl } = await this.createChild.execute(this.actors.actor, body);
    return { account: TenantPresenter.toHttp(tenant), inviteUrl };
  }

  @RequirePermissions('accounts:children')
  @Post('children/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id', idParam) id: string) {
    return TenantPresenter.toHttp(
      await this.setStatus.execute(this.actors.actor, id, { status: 'suspended' }),
    );
  }

  @RequirePermissions('accounts:children')
  @Post('children/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id', idParam) id: string) {
    return TenantPresenter.toHttp(
      await this.setStatus.execute(this.actors.actor, id, { status: 'active' }),
    );
  }

  /** Liga ou desliga "revendedor" (pode criar contas abaixo). */
  @RequirePermissions('accounts:children')
  @Patch('children/:id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    return TenantPresenter.toHttp(await this.setStatus.execute(this.actors.actor, id, body));
  }

  /** Troca o plano (null = o padrão). O revendedor só dá os planos liberados para revenda. */
  @RequirePermissions('accounts:children')
  @Put('children/:id/plan')
  async plan(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(planSchema)) body: z.infer<typeof planSchema>,
  ) {
    const tenant = await this.setPlan.execute(this.actors.actor, id, body.planId);
    return { ...TenantPresenter.toHttp(tenant), planId: tenant.planId };
  }

  /** Quem de uma conta acima entrou nesta (a conta acessada vê). */
  @RequirePermissions('members:manage')
  @Get('parent-accesses')
  async accesses() {
    return (await this.parentAccesses.execute(this.actors.actor)).map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}
