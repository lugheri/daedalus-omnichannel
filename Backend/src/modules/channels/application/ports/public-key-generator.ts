/** Chave pública aleatória do widget do chat do site (vai no HTML do site). */
export interface PublicKeyGenerator {
  generate(): string;
}

export const PUBLIC_KEY_GENERATOR = Symbol('ChannelPublicKeyGenerator');
