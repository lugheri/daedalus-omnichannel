/** Chave pública do formulário: aleatória, impossível de adivinhar, segura em URL. */
export interface PublicKeyGenerator {
  generate(): string;
}

export const PUBLIC_KEY_GENERATOR = Symbol('FormsPublicKeyGenerator');
