import { ApiKey } from '../../../domain/api-key.entity';
import { InvalidApiKeyError } from '../../../domain/errors/invalid-api-key.error';
import { InvalidApiKeyNameError } from '../../../domain/errors/invalid-api-key-name.error';
import { Tenant } from '../../../domain/tenant.entity';
import { InMemoryApiKeyRepository, SequentialApiKeySecretGenerator } from '../../../testing/fakes';
import { accountScenario, TENANT_ID, type AccountScenario } from '../../../testing/scenario';
import {
  AuthenticateApiKeyUseCase,
  CreateApiKeyUseCase,
  ListApiKeysUseCase,
  RevokeApiKeyUseCase,
} from './api-keys.use-cases';

describe('API keys', () => {
  let s: AccountScenario;
  let keys: InMemoryApiKeyRepository;
  let secrets: SequentialApiKeySecretGenerator;

  beforeEach(async () => {
    s = await accountScenario();
    keys = new InMemoryApiKeyRepository();
    secrets = new SequentialApiKeySecretGenerator();
    await s.addMember('dona', 'owner');
    await s.actAs('m-dona');
  });

  const create = (name = 'Site principal') =>
    new CreateApiKeyUseCase(s.currentAccess, keys, secrets, s.ids).execute({ name });
  const authenticate = (raw: string | undefined) =>
    new AuthenticateApiKeyUseCase(keys, secrets, s.tenants).execute(raw);

  it('creates a key shown once; only the hash is stored', async () => {
    const { key, plainKey } = await create();

    expect(plainKey).toBe(`omni_${key.id}.secret-1`);
    // No banco, só o hash e o início do segredo (para reconhecer a chave na tela).
    expect(key.secretHash).toBe('hash(secret-1)');
    expect(key.hint).toBe('secr');
    expect(await new ListApiKeysUseCase(s.currentAccess, keys).execute()).toEqual([key]);
  });

  it('authenticates a valid key and tells its tenant', async () => {
    const { key, plainKey } = await create();
    expect(await authenticate(plainKey)).toEqual({ tenantId: TENANT_ID, keyId: key.id });
    expect(key.lastUsedAt).not.toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['malformed', 'qualquer-coisa'],
    ['unknown id', 'omni_nao-existe.segredo'],
  ])('refuses a %s key', async (_, raw) => {
    await expect(authenticate(raw)).rejects.toThrow(InvalidApiKeyError);
  });

  it('refuses the right id with a wrong secret', async () => {
    const { plainKey } = await create();
    const [id] = plainKey.split('.');
    await expect(authenticate(`${id}.segredo-errado`)).rejects.toThrow(InvalidApiKeyError);
  });

  it('a revoked key stops working at once', async () => {
    const { key, plainKey } = await create();
    await new RevokeApiKeyUseCase(s.currentAccess, keys).execute(key.id);
    await expect(authenticate(plainKey)).rejects.toThrow(InvalidApiKeyError);
  });

  it('a suspended account cannot use its keys', async () => {
    const { plainKey } = await create();
    const tenant = (await s.tenants.findById(TENANT_ID))!;
    await s.tenants.save(
      Tenant.restore(TENANT_ID, { ...tenantProps(tenant), status: 'suspended' }),
    );
    await expect(authenticate(plainKey)).rejects.toThrow(InvalidApiKeyError);
  });

  it('validates the name', async () => {
    await expect(create('   ')).rejects.toThrow(InvalidApiKeyNameError);
  });

  it('only who has integrations:manage manages keys (Owner and Admin by default)', async () => {
    await s.addMember('ana', 'agent');
    await s.actAs('m-ana');
    const access = await s.currentAccess.get();
    expect(access.permissions).not.toContain('integrations:manage');

    await s.addMember('adm', 'admin');
    await s.actAs('m-adm');
    expect((await s.currentAccess.get()).permissions).toContain('integrations:manage');
  });

  it('touch() writes the last use at most every 5 minutes', () => {
    const key = ApiKey.create('k', {
      tenantId: 't',
      name: 'x',
      secretHash: 'h',
      hint: 'abcd',
      createdByMembershipId: 'm',
    });
    const t0 = new Date('2030-01-01T10:00:00Z');
    expect(key.touch(t0)).toBe(true);
    expect(key.touch(new Date('2030-01-01T10:03:00Z'))).toBe(false);
    expect(key.touch(new Date('2030-01-01T10:06:00Z'))).toBe(true);
  });
});

function tenantProps(tenant: Tenant) {
  return {
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    createdAt: tenant.createdAt,
  };
}
