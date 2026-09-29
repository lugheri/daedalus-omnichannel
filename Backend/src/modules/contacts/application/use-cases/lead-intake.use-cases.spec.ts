import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { EmptyImportError } from '../../domain/errors/empty-import.error';
import { ImportTooLargeError } from '../../domain/errors/import-too-large.error';
import { ImportWithoutColumnsError } from '../../domain/errors/import-without-columns.error';
import { InvalidPhoneError } from '../../domain/errors/invalid-phone.error';
import { ContactCreatedEvent } from '../../domain/events/contact-created.event';
import { InMemoryContactRepository } from '../../testing/in-memory-contact.repository';
import { CaptureLeadUseCase } from './capture-lead/capture-lead.use-case';
import { CreateContactUseCase } from './create-contact/create-contact.use-case';
import { ImportContactsUseCase, MAX_IMPORT_ROWS } from './import-contacts/import-contacts.use-case';

describe('Lead intake', () => {
  let tenant: FakeTenantContext;
  let contacts: InMemoryContactRepository;
  let events: RecordingEventBus;
  let ids: SequentialIdGenerator;
  const uow = new ImmediateUnitOfWork();

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    contacts = new InMemoryContactRepository(tenant);
    events = new RecordingEventBus();
    ids = new SequentialIdGenerator();
  });

  const capture = (input: Parameters<CaptureLeadUseCase['execute']>[0]) =>
    new CaptureLeadUseCase(contacts, ids, tenant, events, uow).execute(input);
  const importCsv = (csv: string | Buffer, label: string | null = 'Feira 2026') =>
    new ImportContactsUseCase(contacts, ids, tenant, events, uow).execute({
      content: typeof csv === 'string' ? Buffer.from(csv) : csv,
      label,
    });
  const all = async () => (await contacts.list({ limit: 100 })).items;

  describe('site form', () => {
    it('creates a web_form lead with the campaign', async () => {
      const { contact, created } = await capture({
        name: 'Maria',
        phone: '(11) 98765-4321',
        campaign: 'Black Friday',
      });

      expect(created).toBe(true);
      expect(contact).toMatchObject({ source: 'web_form', sourceDetail: 'Black Friday' });
      expect(events.published).toEqual([expect.any(ContactCreatedEvent)]);
    });

    it('a resubmission does not duplicate; it fills blanks and keeps the first origin', async () => {
      await new CreateContactUseCase(contacts, ids, tenant, events, uow).execute({
        phone: '11987654321',
      });

      const { contact, created } = await capture({
        name: 'Maria',
        phone: '+55 11 98765-4321',
        email: 'maria@exemplo.com',
        campaign: 'Outra campanha',
      });

      expect(created).toBe(false);
      expect(await all()).toHaveLength(1);
      expect(contact).toMatchObject({ name: 'Maria', source: 'manual', sourceDetail: null });
      expect(contact.email?.value).toBe('maria@exemplo.com');
    });

    it('does not take an email that belongs to another contact', async () => {
      await capture({ phone: '11911112222', email: 'joao@x.com' });
      const { contact } = await capture({ phone: '11987654321' });

      await capture({ phone: '11987654321', email: 'joao@x.com' });

      expect((await contacts.findById(contact.id))?.email).toBeNull();
    });

    it('validates the phone like any other entry', async () => {
      await expect(capture({ phone: '123' })).rejects.toThrow(InvalidPhoneError);
    });
  });

  describe('spreadsheet', () => {
    it('imports valid rows and reports duplicates (account and file) and errors per line', async () => {
      await capture({ phone: '11900000001' }); // já existe na conta

      const report = await importCsv(
        [
          'Nome;Celular;E-mail',
          'Ana;(11) 98765-4321;',
          'Bia;11900000001;', //       já existe
          'Carla;;carla@x.com',
          'Ana de novo;11987654321;', // repetida no arquivo
          'Sem contato;;', //            sem telefone nem e-mail
          'Telefone ruim;123;',
          ';;', //                       linha vazia: ignorada
        ].join('\r\n'),
      );

      expect(report).toEqual({
        total: 6,
        created: 2,
        duplicates: 2,
        errors: [
          { line: 6, code: 'CONTACT_WITHOUT_IDENTIFIER' },
          { line: 7, code: 'CONTACT_INVALID_PHONE' },
        ],
      });
      const imported = (await all()).filter((c) => c.source === 'import');
      expect(imported.map((c) => [c.name, c.sourceDetail])).toEqual([
        ['Carla', 'Feira 2026'],
        ['Ana', 'Feira 2026'],
      ]);
    });

    it('reads the Windows Excel encoding (accents) and comma-separated files', async () => {
      const latin1 = Buffer.from('nome,telefone\nJoão,11987654321\n', 'latin1');
      await importCsv(latin1);
      expect((await all())[0].name).toBe('João');
    });

    it('refuses files without a phone/email column, empty or too large', async () => {
      await expect(importCsv('Nome;Cidade\nAna;SP')).rejects.toThrow(ImportWithoutColumnsError);
      await expect(importCsv('Telefone\n')).rejects.toThrow(EmptyImportError);
      const big = [
        'telefone',
        ...Array.from(
          { length: MAX_IMPORT_ROWS + 1 },
          (_, i) => `119${String(i).padStart(8, '0')}`,
        ),
      ];
      await expect(importCsv(big.join('\n'))).rejects.toThrow(ImportTooLargeError);
    });
  });
});
