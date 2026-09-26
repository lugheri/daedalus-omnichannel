import { FakeTenantContext } from '../../../../../shared/testing/fakes';
import { Contact } from '../../../domain/contact.entity';
import { InMemoryContactRepository } from '../../../testing/in-memory-contact.repository';
import { ListContactsUseCase } from './list-contacts.use-case';

describe('ListContactsUseCase', () => {
  let contacts: InMemoryContactRepository;
  let useCase: ListContactsUseCase;

  beforeEach(async () => {
    contacts = new InMemoryContactRepository(new FakeTenantContext('tenant-a'));
    useCase = new ListContactsUseCase(contacts);

    for (const n of [1, 2, 3]) {
      await contacts.save(
        Contact.create(`contact-${n}`, { tenantId: 'tenant-a', phone: `+551198765432${n}` }),
      );
    }
  });

  it('pages through contacts, newest first', async () => {
    const first = await useCase.execute({ limit: 2 });
    expect(first.items.map((c) => c.id)).toEqual(['contact-3', 'contact-2']);
    expect(first.nextCursor).toBe('contact-2');

    const second = await useCase.execute({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((c) => c.id)).toEqual(['contact-1']);
    expect(second.nextCursor).toBeNull();
  });
});
