import type { Readable } from 'node:stream';

/**
 * Armazenamento de arquivos (mídia das conversas). Implementado sobre a API
 * S3: S3 em produção, MinIO em dev — muda só a configuração.
 *
 * O bucket é privado. Arquivos chegam ao navegador só pela API, que confere
 * se o usuário pode ver o recurso a cada download.
 */
export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Para processar no servidor (ex.: o conector enviando ao WhatsApp). */
  read(key: string): Promise<Buffer | null>;
  /** Para repassar ao cliente sem carregar tudo na memória. */
  open(key: string): Promise<{ stream: Readable; size: number | null } | null>;
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FileStorage');
