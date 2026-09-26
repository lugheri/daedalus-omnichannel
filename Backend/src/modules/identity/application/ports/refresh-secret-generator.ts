/** Gera segredos aleatórios para refresh tokens e calcula o hash guardado no banco. */
export interface RefreshSecretGenerator {
  generate(): string;
  hash(secret: string): string;
}

export const REFRESH_SECRET_GENERATOR = Symbol('RefreshSecretGenerator');
