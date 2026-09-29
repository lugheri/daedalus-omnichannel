import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { ApiKey } from '../../../domain/api-key.entity';
import { ApiKeyNotFoundError } from '../../../domain/errors/api-key-not-found.error';
import { InvalidApiKeyError } from '../../../domain/errors/invalid-api-key.error';
import { CurrentAccess } from '../../current-access';
import {
  API_KEY_SECRET_GENERATOR,
  type ApiKeySecretGenerator,
} from '../../ports/api-key-secret-generator';
import { API_KEY_REPOSITORY, type ApiKeyRepository } from '../../ports/api-key.repository';
import { TENANT_REPOSITORY, type TenantRepository } from '../../ports/tenant.repository';

@Injectable()
export class ListApiKeysUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(API_KEY_REPOSITORY) private readonly keys: ApiKeyRepository,
  ) {}

  async execute(): Promise<ApiKey[]> {
    const { tenantId } = await this.currentAccess.get();
    return this.keys.listByTenant(tenantId);
  }
}

/** Cria a chave e devolve o valor completo — a ÚNICA vez em que ele existe. */
@Injectable()
export class CreateApiKeyUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(API_KEY_REPOSITORY) private readonly keys: ApiKeyRepository,
    @Inject(API_KEY_SECRET_GENERATOR) private readonly secrets: ApiKeySecretGenerator,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { name: string }): Promise<{ key: ApiKey; plainKey: string }> {
    const { tenantId, membershipId } = await this.currentAccess.get();
    const { secret, hash } = this.secrets.generate();
    const key = ApiKey.create(this.ids.generate(), {
      tenantId,
      name: input.name,
      secretHash: hash,
      hint: secret.slice(0, 4),
      createdByMembershipId: membershipId,
    });
    await this.keys.save(key);
    return { key, plainKey: ApiKey.format(key.id, secret) };
  }
}

@Injectable()
export class RevokeApiKeyUseCase {
  constructor(
    private readonly currentAccess: CurrentAccess,
    @Inject(API_KEY_REPOSITORY) private readonly keys: ApiKeyRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const { tenantId } = await this.currentAccess.get();
    const key = await this.keys.findInTenant(tenantId, id);
    if (!key) throw new ApiKeyNotFoundError();
    key.revoke();
    await this.keys.save(key);
  }
}

/**
 * Autentica uma chave apresentada numa integração: formato, existência,
 * segredo (hash, tempo constante), não revogada e conta com acesso. Qualquer
 * falha dá o MESMO erro — não revela se a chave existe.
 */
@Injectable()
export class AuthenticateApiKeyUseCase {
  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly keys: ApiKeyRepository,
    @Inject(API_KEY_SECRET_GENERATOR) private readonly secrets: ApiKeySecretGenerator,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async execute(rawKey: string | undefined): Promise<{ tenantId: string; keyId: string }> {
    const parsed = rawKey ? ApiKey.parse(rawKey.trim()) : null;
    const key = parsed ? await this.keys.findForAuthentication(parsed.id) : null;
    if (!parsed || !key || !key.isActive || !this.secrets.matches(parsed.secret, key.secretHash)) {
      throw new InvalidApiKeyError();
    }
    const tenant = await this.tenants.findById(key.tenantId);
    if (!tenant?.allowsAccess) throw new InvalidApiKeyError();

    if (key.touch()) await this.keys.save(key);
    return { tenantId: key.tenantId, keyId: key.id };
  }
}
