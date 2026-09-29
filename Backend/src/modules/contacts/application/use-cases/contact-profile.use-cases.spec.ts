import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  InMemoryActorContext,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { ContactAlreadyExistsError } from '../../domain/errors/contact-already-exists.error';
import { ContactNotFoundError } from '../../domain/errors/contact-not-found.error';
import { ContactWithoutIdentifierError } from '../../domain/errors/contact-without-identifier.error';
import { InvalidNoteError } from '../../domain/errors/invalid-note.error';
import { NoteNotYoursError } from '../../domain/errors/note-not-yours.error';
import { InMemoryContactNoteRepository } from '../../testing/in-memory-contact-note.repository';
import { InMemoryContactRepository } from '../../testing/in-memory-contact.repository';
import { ContactsFacade } from '../contacts.facade';
import {
  AddContactNoteUseCase,
  DeleteContactNoteUseCase,
  ListContactNotesUseCase,
} from './contact-notes/contact-notes.use-cases';
import { CreateContactUseCase } from './create-contact/create-contact.use-case';
import { ListContactsUseCase } from './list-contacts/list-contacts.use-case';
import { UpdateContactUseCase } from './update-contact/update-contact.use-case';

describe('Contact profile', () => {
  let tenant: FakeTenantContext;
  let contacts: InMemoryContactRepository;
  let notes: InMemoryContactNoteRepository;
  let actors: InMemoryActorContext;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    contacts = new InMemoryContactRepository(tenant);
    notes = new InMemoryContactNoteRepository(tenant);
    actors = new InMemoryActorContext();
    actors.authenticate({
      userId: 'user-ana',
      tenantId: 'tenant-a',
      membershipId: 'ana',
      sessionId: 's-1',
    });
    ids = new SequentialIdGenerator();
  });

  const uow = new ImmediateUnitOfWork();
  const create = (input: Parameters<CreateContactUseCase['execute']>[0]) =>
    new CreateContactUseCase(contacts, ids, tenant, new RecordingEventBus(), uow).execute(input);
  const update = (input: Parameters<UpdateContactUseCase['execute']>[0]) =>
    new UpdateContactUseCase(contacts).execute(input);
  const list = (query: Parameters<ListContactsUseCase['execute']>[0]) =>
    new ListContactsUseCase(contacts).execute(query);
  const addNote = (contactId: string, body: string) =>
    new AddContactNoteUseCase(contacts, notes, actors, tenant, ids).execute({ contactId, body });

  describe('origin', () => {
    it('manual registration keeps the origin as manual, with the detail', async () => {
      const contact = await create({
        name: 'Maria',
        phone: '11987654321',
        sourceDetail: ' indicação ',
      });
      expect(contact).toMatchObject({ source: 'manual', sourceDetail: 'indicação' });
    });

    it('a contact created by the first WhatsApp message comes from whatsapp', async () => {
      const facade = new ContactsFacade(contacts, ids, tenant, new RecordingEventBus(), uow);
      await facade.findOrCreateByPhone({ phone: '+5511987654321', name: 'Cliente' });

      const [contact] = (await list({ limit: 10 })).items;
      expect(contact.source).toBe('whatsapp');
    });
  });

  describe('editing', () => {
    it('changes only what was sent, with the same validation as creation', async () => {
      const contact = await create({ name: 'Maria', phone: '11987654321' });

      const updated = await update({ id: contact.id, email: 'MARIA@exemplo.com' });

      expect(updated).toMatchObject({ name: 'Maria' });
      expect(updated.phone?.value).toBe('+5511987654321');
      expect(updated.email?.value).toBe('maria@exemplo.com');
    });

    it('cannot remove both phone and email', async () => {
      const contact = await create({ phone: '11987654321' });
      await expect(update({ id: contact.id, phone: null })).rejects.toThrow(
        ContactWithoutIdentifierError,
      );
    });

    it("cannot take another contact's phone", async () => {
      await create({ phone: '11987654321' });
      const other = await create({ phone: '11911112222' });
      await expect(update({ id: other.id, phone: '(11) 98765-4321' })).rejects.toThrow(
        ContactAlreadyExistsError,
      );
    });

    it("does not reveal other tenants' contacts", async () => {
      const contact = await create({ phone: '11987654321' });
      tenant.switchTo('tenant-b');
      await expect(update({ id: contact.id, name: 'X' })).rejects.toThrow(ContactNotFoundError);
    });
  });

  describe('search and filter', () => {
    it('finds by name, email or phone digits, and filters by origin', async () => {
      await create({ name: 'Maria Souza', phone: '11987654321' });
      await create({ name: 'João', email: 'joao@loja.com', sourceDetail: 'feira' });

      const names = async (query: Parameters<typeof list>[0]) =>
        (await list(query)).items.map((c) => c.name);

      expect(await names({ limit: 10, search: 'souza' })).toEqual(['Maria Souza']);
      expect(await names({ limit: 10, search: 'LOJA' })).toEqual(['João']);
      expect(await names({ limit: 10, search: '98765' })).toEqual(['Maria Souza']);
      expect(await names({ limit: 10, source: 'whatsapp' })).toEqual([]);
      expect(await names({ limit: 10, source: 'manual' })).toHaveLength(2);
    });
  });

  describe('notes', () => {
    it('the author is the authenticated member; newest first', async () => {
      const contact = await create({ phone: '11987654321' });
      await addNote(contact.id, 'Prefere contato à tarde');
      await addNote(contact.id, '  Pediu orçamento de 10 unidades  ');

      const list = await new ListContactNotesUseCase(contacts, notes).execute(contact.id);
      expect(list.map((n) => [n.body, n.authorMembershipId])).toEqual([
        ['Pediu orçamento de 10 unidades', 'ana'],
        ['Prefere contato à tarde', 'ana'],
      ]);
    });

    it('refuses empty notes and notes on missing contacts', async () => {
      const contact = await create({ phone: '11987654321' });
      await expect(addNote(contact.id, '   ')).rejects.toThrow(InvalidNoteError);
      await expect(addNote('no-such-contact', 'oi')).rejects.toThrow(ContactNotFoundError);
    });

    it('only the author deletes a note', async () => {
      const contact = await create({ phone: '11987654321' });
      const note = await addNote(contact.id, 'nota da Ana');
      const remove = () =>
        new DeleteContactNoteUseCase(notes, actors).execute({
          contactId: contact.id,
          noteId: note.id,
        });

      actors.authenticate({
        userId: 'u-bia',
        tenantId: 'tenant-a',
        membershipId: 'bia',
        sessionId: 's-2',
      });
      await expect(remove()).rejects.toThrow(NoteNotYoursError);

      actors.authenticate({
        userId: 'u-ana',
        tenantId: 'tenant-a',
        membershipId: 'ana',
        sessionId: 's-3',
      });
      await remove();
      expect(await notes.findById(note.id)).toBeNull();
    });
  });
});
