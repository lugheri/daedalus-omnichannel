import type { Visitor, VisitorTokens } from '../application/ports/visitor-tokens';
import type {
  VisitorMessage,
  WebChatBackend,
  WebChatInfo,
} from '../application/ports/web-chat-backend';

/** Canais, contatos e mensagens do widget em memória. */
export class FakeWebChatBackend implements WebChatBackend {
  readonly channels = new Map<string, WebChatInfo>();
  readonly identified: {
    name: string;
    phone: string | null;
    email: string | null;
    channelName: string;
  }[] = [];
  readonly received: {
    channelId: string;
    contactId: string;
    externalId: string;
    text: string;
  }[] = [];
  messages: VisitorMessage[] = [];

  channelByKey(key: string): Promise<WebChatInfo | null> {
    return Promise.resolve(this.channels.get(key) ?? null);
  }

  identify(input: {
    name: string;
    phone: string | null;
    email: string | null;
    channelName: string;
  }) {
    this.identified.push(input);
    return Promise.resolve({ contactId: `contact-${this.identified.length}` });
  }

  receive(input: { channelId: string; contactId: string; externalId: string; text: string }) {
    this.received.push(input);
    return Promise.resolve();
  }

  history(): Promise<VisitorMessage[]> {
    return Promise.resolve(this.messages);
  }
}

/** Token legível nos testes: o JSON do visitante. */
export class FakeVisitorTokens implements VisitorTokens {
  sign(visitor: Omit<Visitor, 'expiresAt'>) {
    const expiresAt = new Date(Date.now() + 60_000);
    return { token: JSON.stringify({ ...visitor, expiresAt }), expiresAt };
  }

  verify(token: string): Visitor | null {
    try {
      const v = JSON.parse(token) as Visitor & { since: string; expiresAt: string };
      return { ...v, since: new Date(v.since), expiresAt: new Date(v.expiresAt) };
    } catch {
      return null;
    }
  }
}
