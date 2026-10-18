/** Configuração dos tokens dos visitantes, montada do env no `webchat.module.ts`. */
export interface VisitorTokenSettings {
  /** Base da chave dos tokens dos visitantes (derivada do JWT_SECRET). */
  secret: string;
  /** Validade do token do visitante (a conversa continua no mesmo navegador). */
  tokenTtlMs: number;
}

export const VISITOR_TOKEN_SETTINGS = Symbol('VisitorTokenSettings');
