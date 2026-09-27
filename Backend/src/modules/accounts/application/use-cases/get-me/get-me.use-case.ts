import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor-context';
import { AccountAccessDeniedError } from '../../../domain/errors/account-access-denied.error';
import type { Tenant } from '../../../domain/tenant.entity';
import type { AccountAccess } from '../../account-access';
import { IDENTITY_GATEWAY, type IdentityGateway } from '../../ports/identity.gateway';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';
import { ResolveAccessUseCase } from '../resolve-access/resolve-access.use-case';

export interface Me {
  user: { id: string; name: string; email: string };
  tenant: Tenant;
  access: AccountAccess;
}

/**
 * Quem está logado, em qual conta e o que pode fazer — o frontend usa para
 * montar a tela (esconder botões sem permissão). A API continua checando
 * tudo por conta própria: esconder botão não é segurança.
 */
@Injectable()
export class GetMeUseCase {
  constructor(
    private readonly resolveAccess: ResolveAccessUseCase,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async execute(actor: Actor): Promise<Me> {
    const access = await this.resolveAccess.execute(actor);
    const [user, tenant] = await Promise.all([
      this.identity.findUser(actor.userId),
      this.tenants.findById(actor.tenantId),
    ]);
    if (!user || !tenant) throw new AccountAccessDeniedError();

    return { user, tenant, access };
  }
}
