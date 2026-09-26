/** O par de tokens entregue ao cliente após login, cadastro ou refresh. */
export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
