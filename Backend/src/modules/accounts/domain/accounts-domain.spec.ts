import { DEFAULT_ROLES } from './default-roles';
import { InvalidTenantNameError } from './errors/invalid-tenant-name.error';
import { TenantCreatedEvent } from './events/tenant-created.event';
import { PERMISSIONS } from './permissions';
import { Role } from './role.entity';
import { Slug } from './slug.vo';
import { Tenant } from './tenant.entity';

describe('Slug', () => {
  it.each([
    ['Padaria do Zé', 'padaria-do-ze'],
    ['  ACME   Ltda. ', 'acme-ltda'],
    ['Ação & Cia', 'acao-cia'],
    ['!!!', 'account'],
  ])('derives "%s" → "%s"', (name, expected) => {
    expect(Slug.fromName(name).value).toBe(expected);
  });

  it('never exceeds 50 characters, even with a suffix', () => {
    const slug = Slug.fromName('a'.repeat(80)).withSuffix('x7k2');

    expect(slug.value.length).toBeLessThanOrEqual(50);
    expect(slug.value.endsWith('-x7k2')).toBe(true);
  });
});

describe('Tenant', () => {
  it('starts in trial and emits TenantCreatedEvent', () => {
    const tenant = Tenant.create('tenant-1', { name: 'Padaria', slug: Slug.fromName('Padaria') });

    expect(tenant.status).toBe('trial');
    expect(tenant.allowsAccess).toBe(true);
    expect(tenant.pullEvents()[0]).toBeInstanceOf(TenantCreatedEvent);
  });

  it('rejects names that are too short', () => {
    expect(() => Tenant.create('tenant-1', { name: ' X ', slug: Slug.fromName('x') })).toThrow(
      InvalidTenantNameError,
    );
  });
});

describe('Default roles', () => {
  const byKey = (key: string) => DEFAULT_ROLES.find((r) => r.key === key)!;

  it('gives the Owner every permission and marks it as a system role', () => {
    expect(byKey('owner').permissions).toEqual(PERMISSIONS);
    expect(byKey('owner').isSystem).toBe(true);
  });

  it('keeps account management exclusive to the Owner', () => {
    const others = DEFAULT_ROLES.filter((r) => r.key !== 'owner');

    expect(others.every((r) => !r.permissions.includes('account:manage'))).toBe(true);
  });

  it('limits agents to their own conversations', () => {
    const agent = Role.fromTemplate('role-1', 'tenant-1', byKey('agent'));

    expect(agent.can('conversations:view:own')).toBe(true);
    expect(agent.can('conversations:view:all')).toBe(false);
    expect(agent.can('members:manage')).toBe(false);
  });

  it('copies permissions, so changing a tenant role never touches the template', () => {
    const role = Role.fromTemplate('role-1', 'tenant-1', byKey('agent'));

    expect(role.permissions).not.toBe(byKey('agent').permissions);
  });
});
