/**
 * Quem está executando a operação atual, extraído do access token.
 * Todos os ids vêm do token validado — nunca de dados enviados pelo cliente.
 */
export interface Actor {
  userId: string;
  tenantId: string;
  membershipId: string;
  sessionId: string;
}

export interface ActorContext {
  /** Lança `TenantNotResolvedError` (401) se a operação não foi autenticada. */
  readonly actor: Actor;
  /** Chamado apenas pelo guard de autenticação, uma vez por requisição. */
  authenticate(actor: Actor): void;
}

export const ACTOR_CONTEXT = Symbol('ActorContext');
