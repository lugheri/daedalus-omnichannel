/** Quem é o visitante do chat do site (dentro do token dele). */
export interface Visitor {
  channelId: string;
  tenantId: string;
  contactId: string;
  name: string;
  /** Começo da sessão: o histórico mostrado começa aqui. */
  since: Date;
  expiresAt: Date;
}

/**
 * Token do visitante: assinado pelo servidor, guardado pelo widget no
 * navegador (localStorage do site) e enviado no `Authorization` (nunca em
 * cookie: o site é de outro domínio). Sem estado no servidor.
 */
export interface VisitorTokens {
  sign(visitor: Omit<Visitor, 'expiresAt'>): { token: string; expiresAt: Date };
  /** null = token adulterado, de outro formato ou vencido. */
  verify(token: string): Visitor | null;
}

export const VISITOR_TOKENS = Symbol('VisitorTokens');
