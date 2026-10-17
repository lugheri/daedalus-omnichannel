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
import { RequirePermissions } from './require-permissions.decorator';
import { TenantPresenter } from './tenant.presenter';

const idParam = new ZodValidationPipe(z.uuid());
const createSchema = z.object({
  accountName: z.string().max(200),
  ownerEmail: z.string().max(320),
  /** Revendedor: a conta nova pode criar contas abaixo dela. */
  allowsChildren: z.boolean().default(false),
});
const updateSchema = z.object({ allowsChildren: z.boolean() });

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
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  /** Todas as contas abaixo da atual (filhas, netas...). */
  @RequirePermissions('accounts:children')
  @Get('children')
  async children() {
    return (await this.listChildren.execute(this.actors.actor)).map(
      ({ tenant, parentName, depth }) => ({
        ...TenantPresenter.toHttp(tenant),
        parentId: tenant.parentId,
        parentName,
        depth,
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
