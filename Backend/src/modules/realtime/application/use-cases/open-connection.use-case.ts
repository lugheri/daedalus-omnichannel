import { Inject, Injectable } from '@nestjs/common';
import { RealtimeRooms } from '../../../../shared/application/realtime';
import {
  CONNECTION_AUTHENTICATOR,
  type ConnectionAuthenticator,
} from '../ports/connection-authenticator';

export interface OpenedConnection {
  tenantId: string;
  membershipId: string;
  /** Salas em que a conexão entra: a do membro e uma por permissão. */
  rooms: string[];
  expiresAt: Date;
}

/**
 * Autentica uma conexão WebSocket e decide as salas dela. O gateway é
 * genérico: não sabe de conversas — cada módulo escolhe, ao emitir, para
 * quais salas (membro ou permissão) o aviso vai.
 */
@Injectable()
export class OpenConnectionUseCase {
  constructor(
    @Inject(CONNECTION_AUTHENTICATOR) private readonly authenticator: ConnectionAuthenticator,
  ) {}

  async execute(token: string | undefined): Promise<OpenedConnection> {
    const identity = await this.authenticator.authenticate(token);
    return {
      tenantId: identity.tenantId,
      membershipId: identity.membershipId,
      rooms: [
        RealtimeRooms.member(identity.membershipId),
        ...identity.permissions.map((permission) =>
          RealtimeRooms.permission(identity.tenantId, permission),
        ),
      ],
      expiresAt: identity.expiresAt,
    };
  }
}
