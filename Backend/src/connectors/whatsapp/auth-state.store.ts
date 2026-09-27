import { Inject, Injectable } from '@nestjs/common';
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from 'baileys';
import { PrismaService } from '../../shared/infra/prisma/prisma.service';
import { SecretBox } from '../../shared/infra/crypto/secret-box';

export const CONNECTOR_SECRET_BOX = Symbol('ConnectorSecretBox');

const CREDS_KEY = 'creds';
const entryKey = (type: string, id: string) => `${type}:${id}`;

export interface StoredAuthState {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}

/**
 * Estado de autenticação do Baileys guardado no Postgres, CIFRADO (ADR 0006).
 * Equivale ao `useMultiFileAuthState` da biblioteca — que grava em arquivos e
 * não serve para containers descartáveis —, com uma linha por chave.
 *
 * Quem tem estes dados controla o número: nunca logar, nunca expor.
 */
@Injectable()
export class AuthStateStore {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONNECTOR_SECRET_BOX) private readonly box: SecretBox,
  ) {}

  async load(channelId: string): Promise<StoredAuthState> {
    const creds = (await this.read<AuthenticationCreds>(channelId, CREDS_KEY)) ?? initAuthCreds();

    return {
      state: {
        creds,
        keys: {
          get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
            const data: Record<string, SignalDataTypeMap[T]> = {};
            await Promise.all(
              ids.map(async (id) => {
                let value = await this.read<SignalDataTypeMap[T]>(channelId, entryKey(type, id));
                if (type === 'app-state-sync-key' && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(
                    value as object,
                  ) as unknown as SignalDataTypeMap[T];
                }
                if (value) data[id] = value;
              }),
            );
            return data;
          },
          set: async (data) => {
            const writes: Promise<unknown>[] = [];
            for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
              for (const [id, value] of Object.entries(data[type] ?? {})) {
                writes.push(
                  value
                    ? this.write(channelId, entryKey(type, id), value)
                    : this.remove(channelId, entryKey(type, id)),
                );
              }
            }
            await Promise.all(writes);
          },
        },
      },
      saveCreds: () => this.write(channelId, CREDS_KEY, creds),
    };
  }

  /** Apaga todo o estado (logout): reconectar exigirá novo QR code. */
  async clear(channelId: string): Promise<void> {
    await this.prisma.whatsAppAuthEntry.deleteMany({ where: { channelId } });
  }

  private async read<T>(channelId: string, key: string): Promise<T | null> {
    const row = await this.prisma.whatsAppAuthEntry.findUnique({
      where: { channelId_key: { channelId, key } },
    });
    if (!row) return null;
    return JSON.parse(this.box.openText(Buffer.from(row.value)), BufferJSON.reviver) as T;
  }

  private async write(channelId: string, key: string, value: unknown): Promise<void> {
    const sealed = this.box.seal(JSON.stringify(value, BufferJSON.replacer));
    const bytes = new Uint8Array(sealed);
    await this.prisma.whatsAppAuthEntry.upsert({
      where: { channelId_key: { channelId, key } },
      create: { channelId, key, value: bytes, updatedAt: new Date() },
      update: { value: bytes, updatedAt: new Date() },
    });
  }

  private async remove(channelId: string, key: string): Promise<void> {
    await this.prisma.whatsAppAuthEntry.deleteMany({ where: { channelId, key } });
  }
}
