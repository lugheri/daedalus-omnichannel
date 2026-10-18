/**
 * Avisos em tempo real para as telas (Socket.IO). Qualquer processo pode
 * emitir — inclusive o worker, que não tem servidor de WebSocket: o aviso
 * passa pelo Redis e chega à réplica da API onde o navegador está conectado.
 *
 * Regra: o aviso é só um SINAL ("a conversa X mudou"), nunca o conteúdo. A
 * tela busca os dados pela API, que aplica permissões e escopo. Ainda assim,
 * mande o sinal só para as salas de quem pode ver o recurso.
 */
export interface RealtimeNotifier {
  /** `namespace`: padrão = o do painel; o do chat do site é `WEB_CHAT_NAMESPACE`. */
  emit(
    rooms: readonly string[],
    event: string,
    data: Record<string, unknown>,
    namespace?: string,
  ): Promise<void>;
}

/**
 * Conexões dos visitantes do chat do site (ADR 0012): outro namespace, com
 * autenticação própria (token do visitante, não o login do painel).
 */
export const WEB_CHAT_NAMESPACE = '/chat';

export const REALTIME_NOTIFIER = Symbol('RealtimeNotifier');

/**
 * Salas de cada conexão (o gateway coloca a conexão nelas ao autenticar):
 * o membro, uma sala por permissão que ele tem no tenant e, para cada equipe
 * dele, uma sala por permissão ("supervisores da equipe X" = equipe X +
 * conversations:view:team).
 */
export const RealtimeRooms = {
  member: (membershipId: string) => `member:${membershipId}`,
  permission: (tenantId: string, permission: string) => `tenant:${tenantId}:perm:${permission}`,
  teamPermission: (teamId: string, permission: string) => `team:${teamId}:perm:${permission}`,
  /** O visitante do chat do site (no namespace `WEB_CHAT_NAMESPACE`). */
  webChatVisitor: (channelId: string, contactId: string) => `webchat:${channelId}:${contactId}`,
};
