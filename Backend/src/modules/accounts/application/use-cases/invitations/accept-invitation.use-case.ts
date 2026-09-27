import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { AlreadyMemberError } from '../../../domain/errors/already-member.error';
import { InvitationNotFoundError } from '../../../domain/errors/invitation-not-found.error';
import type { Invitation } from '../../../domain/invitation.entity';
import { Membership } from '../../../domain/membership.entity';
import type { Role } from '../../../domain/role.entity';
import type { Tenant } from '../../../domain/tenant.entity';
import { ACCESS_CACHE, type AccessCache } from '../../ports/access-cache';
import {
  IDENTITY_GATEWAY,
  type IdentityGateway,
  type SessionTokens,
} from '../../ports/identity.gateway';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../ports/invitation.repository';
import {
  INVITATION_TOKEN_GENERATOR,
  type InvitationTokenGenerator,
} from '../../ports/invitation-token-generator';
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from '../../ports/membership.repository';
import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';

export interface InvitationPreview {
  tenant: Tenant;
  email: string;
  role: Role;
  /** true: o e-mail ainda não tem conta — o front pede nome e senha nova. */
  requiresSignup: boolean;
}

/** Resolve um token de convite utilizável, com a conta e o cargo (senão 404). */
async function resolve(
  deps: {
    invitations: InvitationRepository;
    tokens: InvitationTokenGenerator;
    tenants: TenantRepository;
    roles: RoleRepository;
  },
  token: string,
): Promise<{ invitation: Invitation; tenant: Tenant; role: Role }> {
  const invitation = await deps.invitations.findByTokenHash(deps.tokens.hash(token));
  if (!invitation?.isUsableAt(new Date())) throw new InvitationNotFoundError();

  const [tenant, role] = await Promise.all([
    deps.tenants.findById(invitation.tenantId),
    deps.roles.findInTenant(invitation.tenantId, invitation.roleId),
  ]);
  if (!tenant?.allowsAccess || !role) throw new InvitationNotFoundError();
  return { invitation, tenant, role };
}

/** Rota pública: o front mostra "Você foi convidado para <conta>" antes do aceite. */
@Injectable()
export class LookUpInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_TOKEN_GENERATOR) private readonly tokens: InvitationTokenGenerator,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
  ) {}

  private lookupDeps() {
    const { invitations, tokens, tenants, roles } = this;
    return { invitations, tokens, tenants, roles };
  }

  async execute(token: string): Promise<InvitationPreview> {
    const { invitation, tenant, role } = await resolve(this.lookupDeps(), token);
    const user = await this.identity.findUserByEmail(invitation.email);
    return { tenant, email: invitation.email, role, requiresSignup: !user };
  }
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
  /** Obrigatório só para quem ainda não tem conta. */
  name?: string;
}

/**
 * Aceite do convite, tudo numa transação:
 * - quem JÁ tem conta confirma a própria senha (prova que é o dono do e-mail
 *   convidado naquela conta de usuário);
 * - quem não tem cria a conta ali, com o e-mail do convite;
 * - o vínculo nasce ativo com o cargo do convite (ou é reativado, se a pessoa
 *   já esteve na conta) e a sessão abre direto no tenant.
 */
@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_TOKEN_GENERATOR) private readonly tokens: InvitationTokenGenerator,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(ACCESS_CACHE) private readonly cache: AccessCache,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  private lookupDeps() {
    const { invitations, tokens, tenants, roles } = this;
    return { invitations, tokens, tenants, roles };
  }

  async execute(input: AcceptInvitationInput): Promise<{ tenant: Tenant; tokens: SessionTokens }> {
    const result = await this.unitOfWork.run(async () => {
      const { invitation, tenant, role } = await resolve(this.lookupDeps(), input.token);
      invitation.accept(new Date());

      const userId = await this.userFor(invitation.email, input);
      const membership = await this.membershipFor(tenant.id, userId, role.id);

      await this.memberships.save(membership);
      await this.invitations.save(invitation);

      const tokens = await this.identity.startSession({
        userId,
        tenantId: tenant.id,
        membershipId: membership.id,
      });
      return { tenant, tokens, membershipId: membership.id };
    });

    await this.cache.invalidate([result.membershipId]);
    return { tenant: result.tenant, tokens: result.tokens };
  }

  private async userFor(email: string, input: AcceptInvitationInput): Promise<string> {
    const existing = await this.identity.findUserByEmail(email);
    if (existing) {
      return (await this.identity.authenticate({ email, password: input.password })).id;
    }
    const created = await this.identity.registerUser({
      email,
      name: input.name ?? '',
      password: input.password,
    });
    return created.id;
  }

  private async membershipFor(tenantId: string, userId: string, roleId: string) {
    const existing = await this.memberships.findByUser(tenantId, userId);
    if (existing?.isActive) throw new AlreadyMemberError();
    if (existing) {
      existing.enable(roleId);
      return existing;
    }
    return Membership.createActive(this.ids.generate(), { tenantId, userId, roleId });
  }
}
