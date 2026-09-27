import { Injectable } from '@nestjs/common';
import { AccountsFacade } from '../../accounts';
import { IdentityFacade } from '../../identity';
import type {
  ConnectionAuthenticator,
  ConnectionIdentity,
} from '../application/ports/connection-authenticator';

/** Token (identity) + vínculo e permissões (accounts): o mesmo caminho do HTTP. */
@Injectable()
export class FacadesConnectionAuthenticator implements ConnectionAuthenticator {
  constructor(
    private readonly identity: IdentityFacade,
    private readonly accounts: AccountsFacade,
  ) {}

  async authenticate(token: string | undefined): Promise<ConnectionIdentity> {
    const { actor, expiresAt } = await this.identity.authenticateAccessToken(token);
    const access = await this.accounts.accessOf(actor);
    return {
      tenantId: actor.tenantId,
      membershipId: access.membershipId,
      permissions: access.permissions,
      expiresAt,
    };
  }
}
