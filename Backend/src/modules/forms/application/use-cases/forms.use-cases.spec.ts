import {
  FakePlanEntitlements,
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { FormNotFoundError } from '../../domain/errors/form-not-found.error';
import { FormSubmittedEvent } from '../../domain/events/form-submitted.event';
import {
  FakeLeadGateway,
  FakeServiceCatalog,
  InMemoryFormRepository,
  InMemorySubmissionRepository,
  SequentialKeys,
} from '../../testing/fakes';
import {
  AuthenticateFormKeyUseCase,
  CreateFormUseCase,
  DeleteFormUseCase,
  ListContactSubmissionsUseCase,
  ListFormSubmissionsUseCase,
  ListFormsUseCase,
  SubmitFormUseCase,
  UpdateFormUseCase,
} from './forms.use-cases';

describe('Forms', () => {
  let plan: FakePlanEntitlements;
  let tenant: FakeTenantContext;
  let submissions: InMemorySubmissionRepository;
  let forms: InMemoryFormRepository;
  let leads: FakeLeadGateway;
  let events: RecordingEventBus;
  const ids = new SequentialIdGenerator();
  const keys = new SequentialKeys();
  const catalog = new FakeServiceCatalog([
    { id: 'svc-cut', name: 'Corte', priceCents: 5000 },
    { id: 'svc-quote', name: 'Orçamento', priceCents: null },
  ]);

  beforeEach(() => {
    plan = new FakePlanEntitlements();
    tenant = new FakeTenantContext('tenant-a');
    submissions = new InMemorySubmissionRepository(tenant);
    forms = new InMemoryFormRepository(tenant, submissions);
    leads = new FakeLeadGateway();
    events = new RecordingEventBus();
  });

  const create = (
    input: {
      name?: string;
      kind?: string;
      campaign?: string | null;
      successUrl?: string | null;
    } = {},
  ) =>
    new CreateFormUseCase(forms, keys, tenant, ids, plan).execute({
      name: input.name ?? 'Contato do site',
      kind: input.kind ?? 'contact',
      campaign: input.campaign ?? null,
      successUrl: input.successUrl ?? null,
    });
  const update = (id: string, changes: Parameters<UpdateFormUseCase['execute']>[1]) =>
    new UpdateFormUseCase(forms, keys).execute(id, changes);
  /** Como a rota pública: o guard resolve a chave e fixa o tenant; depois, o envio. */
  const submit = async (
    publicKey: string,
    fields: Record<string, string>,
    sourceRef: string | null = null,
  ) => {
    const { formId, tenantId } = await new AuthenticateFormKeyUseCase(forms).execute(publicKey);
    tenant.enter(tenantId);
    return new SubmitFormUseCase(
      forms,
      submissions,
      leads,
      catalog,
      ids,
      events,
      new ImmediateUnitOfWork(),
    ).execute(formId, fields, sourceRef);
  };

  describe('managing forms', () => {
    it('creates with a public key, validates settings and lists with the number of submissions', async () => {
      const form = await create({
        campaign: '  Site novo ',
        successUrl: 'https://loja.com.br/obrigado',
      });
      expect(form).toMatchObject({
        kind: 'contact',
        campaign: 'Site novo',
        sourceLabel: 'Site novo',
        active: true,
      });
      expect(form.publicKey).toMatch(/^key-/);

      await expect(create({ name: ' ' })).rejects.toMatchObject({ code: 'FORM_INVALID_NAME' });
      await expect(create({ kind: 'survey' })).rejects.toMatchObject({ code: 'FORM_INVALID_KIND' });
      await expect(create({ successUrl: 'javascript:alert(1)' })).rejects.toMatchObject({
        code: 'FORM_INVALID_SUCCESS_URL',
      });

      await submit(form.publicKey, { name: 'Ana', phone: '11999990000' });
      const [listed] = await new ListFormsUseCase(forms, submissions).execute();
      expect(listed.submissions).toBe(1);
    });

    it('rotating the key retires the old URL; an inactive form refuses submissions', async () => {
      const form = await create();
      const rotated = await update(form.id, { rotateKey: true });
      expect(rotated.publicKey).not.toBe(form.publicKey);
      await expect(submit(form.publicKey, { phone: '11999990000' })).rejects.toThrow(
        FormNotFoundError,
      );

      await update(form.id, { active: false });
      await expect(submit(rotated.publicKey, { phone: '11999990000' })).rejects.toMatchObject({
        code: 'FORM_INACTIVE',
      });
    });

    it('another account does not see it; deleting takes its submissions', async () => {
      const form = await create();
      await submit(form.publicKey, { phone: '11999990000' });
      tenant.switchTo('tenant-b');
      expect(await new ListFormsUseCase(forms, submissions).execute()).toEqual([]);
      await expect(update(form.id, { name: 'x' })).rejects.toThrow(FormNotFoundError);

      tenant.switchTo('tenant-a');
      await new DeleteFormUseCase(forms).execute(form.id);
      expect(submissions.items).toHaveLength(0);
    });
  });

  it('the plan limits how many forms the account has', async () => {
    plan.limits.forms = 1;
    await create();
    await expect(create()).rejects.toMatchObject({ code: 'PLAN_LIMIT_FORMS' });
  });

  describe('public submission', () => {
    it('registers the lead with the form label, keeps the submission and announces it', async () => {
      const form = await create({ campaign: 'Landing Verão' });
      const result = await submit(form.publicKey, {
        name: '  Ana ',
        phone: '11999990000',
        message: 'Quero saber o preço',
        // Contato não tem serviço nem data: ignorados.
        serviceId: 'svc-cut',
        preferredDate: 'sábado',
      });

      expect(result).toEqual({ successUrl: null });
      expect(leads.captured).toEqual([
        { name: 'Ana', phone: '11999990000', email: null, campaign: 'Landing Verão' },
      ]);
      expect(submissions.items[0]).toMatchObject({
        formId: form.id,
        contactId: 'contact-1',
        name: 'Ana',
        message: 'Quero saber o preço',
        serviceId: null,
        preferredDate: null,
      });
      expect(events.published).toEqual([
        expect.objectContaining({
          eventName: FormSubmittedEvent.eventName,
          kind: 'contact',
          contactId: 'contact-1',
          service: null,
        }),
      ]);
    });

    it('the page origin (?ref=) goes to the submission and the event; a bad one is ignored', async () => {
      const form = await create({});
      await submit(form.publicKey, { phone: '11999990000' }, 'lp:0199-variante');
      await submit(form.publicKey, { phone: '11999990000' }, '<script>');
      expect(submissions.items.map((s) => s.sourceRef)).toEqual(['lp:0199-variante', null]);
      expect(events.published.map((e) => (e as FormSubmittedEvent).sourceRef)).toEqual([
        'lp:0199-variante',
        null,
      ]);
    });

    it('a service request carries the chosen site service (name and price)', async () => {
      const form = await create({
        name: 'Agende',
        kind: 'service',
        successUrl: 'https://x.com/ok',
      });
      const result = await submit(form.publicKey, {
        name: 'Bia',
        email: 'bia@exemplo.com',
        serviceId: 'svc-cut',
        preferredDate: 'sábado de manhã',
      });

      expect(result.successUrl).toBe('https://x.com/ok');
      expect(submissions.items[0]).toMatchObject({
        serviceId: 'svc-cut',
        serviceName: 'Corte',
        preferredDate: 'sábado de manhã',
      });
      expect(events.published[0]).toMatchObject({
        kind: 'service',
        service: { id: 'svc-cut', name: 'Corte', priceCents: 5000 },
      });

      await expect(
        submit(form.publicKey, { email: 'x@y.com', serviceId: 'svc-hidden' }),
      ).rejects.toMatchObject({ code: 'FORM_UNKNOWN_SERVICE' });
    });

    it('refuses oversized fields and an unknown key; contact rules come from contacts', async () => {
      const form = await create();
      await expect(
        submit(form.publicKey, { phone: '11999990000', message: 'x'.repeat(2001) }),
      ).rejects.toMatchObject({ code: 'FORM_INVALID_FIELD' });
      await expect(submit('nope', { phone: '1' })).rejects.toThrow(FormNotFoundError);
      await expect(submit(form.publicKey, { name: 'Sem contato' })).rejects.toMatchObject({
        code: 'CONTACT_WITHOUT_IDENTIFIER',
      });
      expect(submissions.items).toHaveLength(0);
    });

    it('lists submissions by form and by contact (with the form name)', async () => {
      const contact = await create({ name: 'Contato' });
      const service = await create({ name: 'Serviço', kind: 'service' });
      await submit(contact.publicKey, { phone: '11999990000', message: 'Primeira' });
      await submit(service.publicKey, { phone: '11999990000', serviceId: 'svc-quote' });

      const byForm = await new ListFormSubmissionsUseCase(forms, submissions).execute(contact.id);
      expect(byForm.map((s) => s.message)).toEqual(['Primeira']);

      const byContact = await new ListContactSubmissionsUseCase(forms, submissions).execute(
        'contact-1',
      );
      expect(byContact.map((s) => [s.formName, s.submission.serviceName])).toEqual([
        ['Serviço', 'Orçamento'],
        ['Contato', null],
      ]);
    });
  });
});
