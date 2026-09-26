import { Injectable } from '@nestjs/common';
import { IdentityFacade } from '../../identity';
import type { IdentityGateway, SessionTokens } from '../application/ports/identity.gateway';

/** Adapter do port IdentityGateway sobre a API pública do módulo identity. */
@Injectable()
export class IdentityFacadeGateway implements IdentityGateway {
  constructor(private readonly identity: IdentityFacade) {}

  registerUser(input: { email: string; name: string; password: string }) {
    return this.identity.registerUser(input);
  }

  authenticate(input: { email: string; password: string }) {
    return this.identity.verifyCredentials(input);
  }

  startSession(input: {
    userId: string;
    tenantId: string;
    membershipId: string;
  }): Promise<SessionTokens> {
    return this.identity.startSession(input);
  }
}
