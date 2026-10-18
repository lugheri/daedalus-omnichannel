import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { RealtimeRooms, WEB_CHAT_NAMESPACE } from '../../../shared/application/realtime';
import type { Visitor } from '../application/ports/visitor-tokens';
import { AuthenticateVisitorUseCase } from '../application/web-chat.use-cases';

const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * WebSocket dos visitantes do chat do site (namespace `/chat`, ADR 0012).
 * Separado do painel: autentica pelo token do visitante (`auth.token`) e põe
 * a conexão só na sala dele. Só RECEBE avisos ("chegou mensagem"); o widget
 * busca as mensagens pela API. Só WebSocket (sem long-polling): o navegador
 * não aplica CORS a WebSocket, e o site é de qualquer domínio.
 */
@WebSocketGateway({ namespace: WEB_CHAT_NAMESPACE })
export class WebChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebChatGateway.name);
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly authenticate: AuthenticateVisitorUseCase) {}

  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      const auth = socket.handshake.auth as { token?: unknown } | undefined;
      try {
        const visitor = this.authenticate.verify(
          typeof auth?.token === 'string' ? auth.token : undefined,
        );
        (socket.data as { visitor?: Visitor }).visitor = visitor;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { visitor } = socket.data as { visitor?: Visitor };
    if (!visitor) return void socket.disconnect(true);
    await socket.join(RealtimeRooms.webChatVisitor(visitor.channelId, visitor.contactId));
    const ttl = Math.min(visitor.expiresAt.getTime() - Date.now(), MAX_TIMER_MS);
    this.expiryTimers.set(
      socket.id,
      setTimeout(() => socket.disconnect(true), Math.max(ttl, 0)),
    );
    this.logger.debug(`Visitante ${visitor.contactId} conectado ao chat ${visitor.channelId}`);
  }

  handleDisconnect(socket: Socket): void {
    clearTimeout(this.expiryTimers.get(socket.id));
    this.expiryTimers.delete(socket.id);
  }
}
