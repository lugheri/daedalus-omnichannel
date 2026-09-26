import { FakeTenantContext } from '../../../../../shared/testing/fakes';
import { Contact } from '../../../domain/contact.entity';
import { ContactNotFoundError } from '../../../domain/errors/contact-not-found.error';
import { InMemoryContactRepository } from '../../../testing/in-memory-contact.repository';
import { GetContactUseCase } from './get-contact.use-case';

describe('GetContactUseCase', () => {
  let tenant: FakeTenantContext;
  let contacts: InMemoryContactRepository;
  let useCase: GetContactUseCase;

  beforeEach(async () => {
    tenant = new FakeTenantContext('tenant-a');
    contacts = new InMemoryContactRepository(tenant);
    useCase = new GetContactUseCase(contacts);

    await contacts.save(
      Contact.create('contact-1', { tenantId: 'tenant-a', phone: '+5511987654321' }),
    );
  });

  it('returns a contact of the current tenant', async () => {
    const contact = await useCase.execute('contact-1');

    expect(contact.id).toBe('contact-1');
  });

  it('throws ContactNotFoundError for an unknown id', async () => {
    await expect(useCase.execute('missing')).rejects.toThrow(ContactNotFoundError);
  });

  it('does not reveal contacts of another tenant', async () => {
    tenant.switchTo('tenant-b');

    await expect(useCase.execute('contact-1')).rejects.toThrow(ContactNotFoundError);
  });
});
