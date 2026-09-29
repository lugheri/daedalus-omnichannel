import { Entity } from '../../../shared/domain/entity';
import { InvalidApiKeyNameError } from './errors/invalid-api-key-name.error';

export interface ApiKeyProps {
  tenantId: string;
  name: string;
  /** SHA-256 do segredo; o segredo em si só existe na criação. */
  secretHash: string;
  /** Início do segredo, para reconhecer a chave na tela (ex.: "Xk3f…"). */
  hint: string;
  createdByMembershipId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/** Não grava o "último uso" a cada requisição — no máximo a cada 5 minutos. */
const LAST_USED_RESOLUTION_MS = 5 * 60_000;

/**
 * Chave de API da conta, para integrações servidor a servidor (ex.: o
 * formulário do site cria leads). Formato entregue ao cliente:
 * `omni_<id>.<segredo>` — o id localiza a chave, o segredo é conferido pelo hash.
 */
export class ApiKey extends Entity<ApiKeyProps> {
  static readonly PREFIX = 'omni_';

  static create(
    id: string,
    input: Pick<ApiKeyProps, 'tenantId' | 'name' | 'secretHash' | 'hint' | 'createdByMembershipId'>,
  ): ApiKey {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 60) throw new InvalidApiKeyNameError();
    return new ApiKey(id, {
      ...input,
      name,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });
  }

  static restore(id: string, props: ApiKeyProps): ApiKey {
    return new ApiKey(id, props);
  }

  /** A chave completa, como o cliente a recebe (só no momento da criação). */
  static format(id: string, secret: string): string {
    return `${ApiKey.PREFIX}${id}.${secret}`;
  }

  /** `omni_<id>.<segredo>` → partes; null se o formato não bate. */
  static parse(raw: string): { id: string; secret: string } | null {
    if (!raw.startsWith(ApiKey.PREFIX)) return null;
    const [id, secret] = raw.slice(ApiKey.PREFIX.length).split('.');
    return id && secret ? { id, secret } : null;
  }

  get isActive(): boolean {
    return this.props.revokedAt === null;
  }

  revoke(): void {
    this.props.revokedAt ??= new Date();
  }

  /** Registra o uso; devolve se vale a pena gravar (evita uma escrita por requisição). */
  touch(now = new Date()): boolean {
    const last = this.props.lastUsedAt?.getTime() ?? 0;
    if (now.getTime() - last < LAST_USED_RESOLUTION_MS) return false;
    this.props.lastUsedAt = now;
    return true;
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get secretHash() {
    return this.props.secretHash;
  }
  get hint() {
    return this.props.hint;
  }
  get createdByMembershipId() {
    return this.props.createdByMembershipId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get lastUsedAt() {
    return this.props.lastUsedAt;
  }
  get revokedAt() {
    return this.props.revokedAt;
  }
}
