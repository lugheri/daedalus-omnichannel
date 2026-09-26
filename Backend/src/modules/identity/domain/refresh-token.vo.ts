/**
 * Refresh token no formato `<sessionId>.<secret>`. O id localiza a sessão;
 * o segredo prova a posse. No banco fica só o HASH do segredo — um vazamento
 * da tabela não entrega tokens utilizáveis.
 */
export class RefreshToken {
  private constructor(
    readonly sessionId: string,
    readonly secret: string,
  ) {}

  static compose(sessionId: string, secret: string): RefreshToken {
    return new RefreshToken(sessionId, secret);
  }

  /** Devolve `null` para qualquer formato inválido — quem chama decide o erro. */
  static parse(raw: string): RefreshToken | null {
    const separator = raw.indexOf('.');
    if (separator <= 0 || separator === raw.length - 1) return null;
    return new RefreshToken(raw.slice(0, separator), raw.slice(separator + 1));
  }

  toString(): string {
    return `${this.sessionId}.${this.secret}`;
  }
}
