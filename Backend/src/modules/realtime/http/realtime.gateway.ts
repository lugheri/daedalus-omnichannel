import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  OpenConnectionUseCase,
  type OpenedConnection,
} from '../application/use-cases/open-connection.use-case';

/** O erro que o cliente recebe em `connect_error` quando o token não vale. */
export const UNAUTHORIZED = 'unauthorized';

/** Teto de um timer do Node (~24,8 dias); tokens nunca chegam perto. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Conexão em tempo real do painel (Socket.IO, caminho padrão `/socket.io`).
 *
 * - O navegador manda o access token em `auth.token` ao conectar; sem token
 *   válido, a conexão é recusada (`connect_error: unauthorized`).
 * - A conexão entra nas salas do membro (ver OpenConnectionUseCase) e só
 *   RECEBE avisos — não há mensagens do cliente para o servidor.
 * - Quando o token expira, o servidor derruba a conexão: o cliente renova a
 *   sessão e reconecta. Assim nenhuma conexão sobrevive a um acesso revogado
 *   por mais que a validade do token (15 min).
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly openConnection: OpenConnectionUseCase) {}

  afterInit(server: Server): void {
    // Middleware: roda antes de a conexão ser aceita.
    server.use((socket, next) => {
      const auth = socket.handshake.auth as { token?: unknown } | undefined;
      const token = typeof auth?.token === 'string' ? auth.token : undefined;
      this.openConnection
        .execute(token)
        .then((connection) => {
          (socket.data as { connection?: OpenedConnection }).connection = connection;
          next();
        })
        .catch(() => next(new Error(UNAUTHORIZED)));
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { connection } = socket.data as { connection?: OpenedConnection };
    if (!connection) return void socket.disconnect(true);

    await socket.join(connection.rooms);
    const ttl = Math.min(connection.expiresAt.getTime() - Date.now(), MAX_TIMER_MS);
    this.expiryTimers.set(
      socket.id,
      setTimeout(() => socket.disconnect(true), Math.max(ttl, 0)),
    );
    this.logger.debug(`Conexão ${socket.id} do membro ${connection.membershipId}`);
  }

  handleDisconnect(socket: Socket): void {
    clearTimeout(this.expiryTimers.get(socket.id));
    this.expiryTimers.delete(socket.id);
  }
}
