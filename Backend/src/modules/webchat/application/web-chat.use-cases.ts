import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { InvalidVisitorError } from '../domain/errors/invalid-visitor.error';
import { VisitorTokenInvalidError } from '../domain/errors/visitor-token-invalid.error';
import { WebChatNotFoundError } from '../domain/errors/web-chat-not-found.error';
import { WebChatUnavailableError } from '../domain/errors/web-chat-unavailable.error';
import { VISITOR_TOKENS, type Visitor, type VisitorTokens } from './ports/visitor-tokens';
import {
  WEB_CHAT_BACKEND,
  type VisitorMessage,
  type WebChatBackend,
  type WebChatInfo,
} from './ports/web-chat-backend';

/** Maior mensagem do visitante (o canal corta no mesmo tamanho). */
export const MAX_VISITOR_TEXT = 2_000;
/** Id que o widget gera para cada mensagem (idempotência no reenvio). */
const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

async function activeChannel(backend: WebChatBackend, key: string): Promise<WebChatInfo> {
  const channel = await backend.channelByKey(key);
  if (!channel) throw new WebChatNotFoundError();
  if (!channel.active) throw new WebChatUnavailableError();
  return channel;
}

/** O que o widget mostra antes de qualquer conversa (título, saudação, cor). */
@Injectable()
export class GetWidgetConfigUseCase {
  constructor(@Inject(WEB_CHAT_BACKEND) private readonly backend: WebChatBackend) {}

  async execute(key: string): Promise<WebChatInfo> {
    const channel = await this.backend.channelByKey(key);
    if (!channel) throw new WebChatNotFoundError();
    return channel;
  }
}

/**
 * O visitante se identifica (nome + telefone e/ou e-mail): vira contato da
 * conta (lead "Chat do site") e recebe o token da sessão. O histórico que
 * ele vê começa agora.
 */
@Injectable()
export class StartVisitorSessionUseCase {
  constructor(
    @Inject(WEB_CHAT_BACKEND) private readonly backend: WebChatBackend,
    @Inject(VISITOR_TOKENS) private readonly tokens: VisitorTokens,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(
    key: string,
    input: { name: string; phone: string | null; email: string | null },
  ): Promise<{ token: string; expiresAt: Date; name: string }> {
    const name = input.name.trim().slice(0, 120);
    if (!name) throw new InvalidVisitorError('WEB_CHAT_INVALID_NAME');
    const phone = input.phone?.trim() || null;
    const email = input.email?.trim() || null;
    if (!phone && !email) throw new InvalidVisitorError('WEB_CHAT_CONTACT_REQUIRED');

    const channel = await activeChannel(this.backend, key);
    this.tenant.enter(channel.tenantId);
    const { contactId } = await this.backend.identify({
      name,
      phone,
      email,
      channelName: channel.name,
    });
    const { token, expiresAt } = this.tokens.sign({
      channelId: channel.channelId,
      tenantId: channel.tenantId,
      contactId,
      name,
      since: new Date(),
    });
    return { token, expiresAt, name };
  }
}

/**
 * Token do visitante → quem ele é. `execute` (rotas HTTP) também fixa o
 * tenant do canal; `verify` só confere (o handshake do WebSocket não tem
 * contexto de requisição, e lá não há o que consultar).
 */
@Injectable()
export class AuthenticateVisitorUseCase {
  constructor(
    @Inject(VISITOR_TOKENS) private readonly tokens: VisitorTokens,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  execute(token: string | undefined): Visitor {
    const visitor = this.verify(token);
    this.tenant.enter(visitor.tenantId);
    return visitor;
  }

  verify(token: string | undefined): Visitor {
    const visitor = token ? this.tokens.verify(token) : null;
    if (!visitor) throw new VisitorTokenInvalidError();
    return visitor;
  }
}

@Injectable()
export class VisitorHistoryUseCase {
  constructor(@Inject(WEB_CHAT_BACKEND) private readonly backend: WebChatBackend) {}

  execute(visitor: Visitor): Promise<VisitorMessage[]> {
    return this.backend.history({
      channelId: visitor.channelId,
      contactId: visitor.contactId,
      since: visitor.since,
    });
  }
}

/**
 * Mensagem do visitante: vai para a caixa de entrada (pela fila). O `id` é do
 * widget — reenviar a mesma mensagem (rede caiu) não duplica.
 */
@Injectable()
export class SendVisitorMessageUseCase {
  constructor(@Inject(WEB_CHAT_BACKEND) private readonly backend: WebChatBackend) {}

  async execute(visitor: Visitor, input: { id: string; text: string }): Promise<void> {
    const text = input.text.trim();
    if (!text || text.length > MAX_VISITOR_TEXT || !CLIENT_ID.test(input.id)) {
      throw new InvalidVisitorError('WEB_CHAT_INVALID_MESSAGE');
    }
    await this.backend.receive({
      channelId: visitor.channelId,
      contactId: visitor.contactId,
      contactName: visitor.name,
      externalId: `web-${input.id}`,
      text,
    });
  }
}
