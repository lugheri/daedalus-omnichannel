/**
 * O que o widget usa dos outros módulos (channels, contacts, conversations),
 * pelas facades deles. Adapter em infra/.
 */
export interface WebChatInfo {
  channelId: string;
  tenantId: string;
  name: string;
  title: string;
  greeting: string;
  color: string;
  /** Desligado: o widget não aparece e não aceita mensagens. */
  active: boolean;
}

export interface VisitorMessage {
  id: string;
  /** Mensagem do visitante: o id que o widget gerou. */
  clientId: string | null;
  direction: 'inbound' | 'outbound';
  text: string;
  sentAt: Date;
}

export interface WebChatBackend {
  /** Pela chave pública do widget, em qualquer conta (a chave diz a conta). */
  channelByKey(key: string): Promise<WebChatInfo | null>;
  /** No tenant do canal: o contato do visitante (achado pelo telefone/e-mail ou criado). */
  identify(input: {
    name: string;
    phone: string | null;
    email: string | null;
    channelName: string;
  }): Promise<{ contactId: string }>;
  /** No tenant do canal: a mensagem do visitante vai para a caixa de entrada. */
  receive(input: {
    channelId: string;
    contactId: string;
    contactName: string;
    externalId: string;
    text: string;
  }): Promise<void>;
  /** No tenant do canal: as mensagens da conversa desde o começo da sessão. */
  history(input: { channelId: string; contactId: string; since: Date }): Promise<VisitorMessage[]>;
}

export const WEB_CHAT_BACKEND = Symbol('WebChatBackend');
