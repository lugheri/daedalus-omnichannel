import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { AppClsStore } from '../../../shared/infra/context/app-cls-store';
import { AccountsFacade } from '../../accounts';
import { IdentityFacade } from '../../identity';
import { TeamsFacade } from '../../teams';
import type {
  ConnectionAuthenticator,
  ConnectionIdentity,
} from '../application/ports/connection-authenticator';

/** Token (identity) + vínculo e permissões (accounts) + equipes (teams). */
@Injectable()
export class FacadesConnectionAuthenticator implements ConnectionAuthenticator {
  constructor(
    private readonly identity: IdentityFacade,
    private readonly accounts: AccountsFacade,
    private readonly teams: TeamsFacade,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async authenticate(token: string | undefined): Promise<ConnectionIdentity> {
    const { actor, expiresAt } = await this.identity.authenticateAccessToken(token);
    const access = await this.accounts.accessOf(actor);
    // A conexão WebSocket não passa pelo middleware HTTP que abre o contexto
    // da operação: abre aqui, com o tenant do token, para o repositório de equipes.
    const teamIds = await this.cls.run(() => {
      this.cls.set('tenantId', actor.tenantId);
      return this.teams.teamIdsOf(access.membershipId);
    });
    return {
      tenantId: actor.tenantId,
      membershipId: access.membershipId,
      permissions: access.permissions,
      teamIds,
      expiresAt,
    };
  }
}
