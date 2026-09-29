/**
 * Cifra segredos guardados no banco (ex.: chaves de API de provedores dos
 * clientes). O texto cifrado é opaco (base64) e detecta adulteração: um
 * valor alterado no banco falha ao abrir, em vez de virar lixo silencioso.
 */
export interface SecretCipher {
  seal(plaintext: string): string;
  /** Lança se o valor foi adulterado ou cifrado com outra chave. */
  open(sealed: string): string;
}

export const SECRET_CIPHER = Symbol('SecretCipher');
