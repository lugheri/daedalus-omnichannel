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
  emit(rooms: readonly string[], event: string, data: Record<string, unknown>): Promise<void>;
}

export const REALTIME_NOTIFIER = Symbol('RealtimeNotifier');

/**
 * Salas de cada conexão (o gateway coloca a conexão nelas ao autenticar):
 * o membro, e uma sala por permissão que ele tem no tenant.
 */
export const RealtimeRooms = {
  member: (membershipId: string) => `member:${membershipId}`,
  permission: (tenantId: string, permission: string) => `tenant:${tenantId}:perm:${permission}`,
};
