import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 1;

/**
 * Criptografia de segredos guardados no banco (sessões do WhatsApp, tokens de
 * provedores). AES-256-GCM: além de cifrar, detecta adulteração — um valor
 * alterado no banco falha ao abrir, em vez de virar lixo silencioso.
 *
 * Formato: [versão (1 byte)][IV (12)][tag (16)][texto cifrado]. A versão
 * permite trocar de algoritmo/chave no futuro sem perder o que já existe.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY precisa ter 32 bytes (base64 de 32 bytes aleatórios)');
    }
  }

  seal(plaintext: string | Buffer): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), encrypted]);
  }

  open(sealed: Buffer): Buffer {
    if (sealed[0] !== VERSION) throw new Error(`Unsupported secret box version ${sealed[0]}`);
    const iv = sealed.subarray(1, 1 + IV_BYTES);
    const tag = sealed.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
    const encrypted = sealed.subarray(1 + IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  openText(sealed: Buffer): string {
    return this.open(sealed).toString('utf8');
  }
}
