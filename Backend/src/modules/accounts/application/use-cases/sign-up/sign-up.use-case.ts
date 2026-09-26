import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { DEFAULT_ROLES } from '../../../domain/default-roles';
import { Membership } from '../../../domain/membership.entity';
import { Role } from '../../../domain/role.entity';
import { Slug } from '../../../domain/slug.vo';
import { Tenant } from '../../../domain/tenant.entity';
import {
  IDENTITY_GATEWAY,
  type IdentityGateway,
  type SessionTokens,
} from '../../ports/identity.gateway';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';

export interface SignUpInput {
  accountName: string;
  name: string;
  email: string;
  password: string;
}

export interface SignUpResult {
  tenant: Tenant;
  userId: string;
  tokens: SessionTokens;
}

const MAX_SLUG_ATTEMPTS = 5;

/**
 * Cadastro de uma conta nova: cria o tenant, os cargos padrão, o usuário e o
 * vínculo de Owner — tudo ou nada, numa única transação — e já devolve os
 * tokens, para a pessoa entrar direto.
 */
@Injectable()
export class SignUpUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  execute(input: SignUpInput): Promise<SignUpResult> {
    return this.unitOfWork.run(async () => {
      const tenant = Tenant.create(this.ids.generate(), {
        name: input.accountName,
        slug: await this.uniqueSlugFor(input.accountName),
      });
      const roles = DEFAULT_ROLES.map((template) =>
        Role.fromTemplate(this.ids.generate(), tenant.id, template),
      );
      const ownerRole = roles.find((role) => role.key === 'owner')!;

      const user = await this.identity.registerUser({
        email: input.email,
        name: input.name,
        password: input.password,
      });

      const membership = Membership.createActive(this.ids.generate(), {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRole.id,
      });

      await this.tenants.save(tenant);
      await this.roles.saveMany(roles);
      await this.memberships.save(membership);
      await this.events.publish(tenant.pullEvents());

      const tokens = await this.identity.startSession({
        userId: user.id,
        tenantId: tenant.id,
        membershipId: membership.id,
      });

      return { tenant, userId: user.id, tokens };
    });
  }

  private async uniqueSlugFor(name: string): Promise<Slug> {
    const base = Slug.fromName(name);
    let candidate = base;

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      if (!(await this.tenants.existsBySlug(candidate))) return candidate;
      candidate = base.withSuffix(this.randomSuffix());
    }
    throw new Error(`Could not find a free slug for "${name}"`);
  }

  private randomSuffix(): string {
    // O fim de um UUIDv7 é aleatório: serve de sufixo curto e sem colisão prática.
    return this.ids.generate().replace(/-/g, '').slice(-6);
  }
}
