import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../../shared/testing/fakes';
import { ContactAlreadyExistsError } from '../../../domain/errors/contact-already-exists.error';
import { ContactCreatedEvent } from '../../../domain/events/contact-created.event';
import { InMemoryContactRepository } from '../../../testing/in-memory-contact.repository';
import { CreateContactUseCase } from './create-contact.use-case';

describe('CreateContactUseCase', () => {
  let tenant: FakeTenantContext;
  let contacts: InMemoryContactRepository;
  let events: RecordingEventBus;
  let useCase: CreateContactUseCase;

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    contacts = new InMemoryContactRepository(tenant);
    events = new RecordingEventBus();
    useCase = new CreateContactUseCase(
      contacts,
      new SequentialIdGenerator(),
      tenant,
      events,
      new ImmediateUnitOfWork(),
    );
  });

  it('creates the contact in the current tenant', async () => {
    const contact = await useCase.execute({ name: 'Maria', phone: '+5511987654321' });

    expect(contact.id).toBe('id-1');
    expect(contact.tenantId).toBe('tenant-a');
    expect(await contacts.findById('id-1')).toBe(contact);
  });

  it('publishes ContactCreatedEvent after saving', async () => {
    await useCase.execute({ phone: '+5511987654321' });

    expect(events.published).toHaveLength(1);
    expect(events.published[0]).toBeInstanceOf(ContactCreatedEvent);
  });

  it('rejects a phone already used in the same tenant', async () => {
    await useCase.execute({ phone: '+5511987654321' });

    await expect(useCase.execute({ phone: '+55 11 98765-4321' })).rejects.toThrow(
      ContactAlreadyExistsError,
    );
    expect(events.published).toHaveLength(1);
  });

  it('rejects an email already used in the same tenant', async () => {
    await useCase.execute({ email: 'maria@example.com' });

    await expect(useCase.execute({ email: 'MARIA@example.com' })).rejects.toThrow(
      ContactAlreadyExistsError,
    );
  });

  it('allows the same phone in different tenants', async () => {
    await useCase.execute({ phone: '+5511987654321' });
    tenant.switchTo('tenant-b');

    const contact = await useCase.execute({ phone: '+5511987654321' });

    expect(contact.tenantId).toBe('tenant-b');
  });
});
