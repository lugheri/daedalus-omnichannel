/** Segredo aleatório da chave de API e o hash que fica no banco. */
export interface ApiKeySecretGenerator {
  generate(): { secret: string; hash: string };
  hash(secret: string): string;
  /** Comparação em tempo constante (não vaza, pelo tempo de resposta, quanto do hash bateu). */
  matches(secret: string, hash: string): boolean;
}

export const API_KEY_SECRET_GENERATOR = Symbol('ApiKeySecretGenerator');
