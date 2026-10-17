import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { FormNotFoundError } from '../../domain/errors/form-not-found.error';
import { InvalidFormError } from '../../domain/errors/invalid-form.error';
import { FormSubmittedEvent } from '../../domain/events/form-submitted.event';
import { Form, type FormSettings } from '../../domain/form.entity';
import { cleanFields, type FormSubmission, type SubmissionFields } from '../../domain/submission';
import { FORM_REPOSITORY, type FormRepository } from '../ports/form.repository';
import { LEAD_GATEWAY, type LeadGateway } from '../ports/lead-gateway';
import { PUBLIC_KEY_GENERATOR, type PublicKeyGenerator } from '../ports/public-key-generator';
import { SERVICE_CATALOG, type ServiceCatalog } from '../ports/service-catalog';
import { SUBMISSION_REPOSITORY, type SubmissionRepository } from '../ports/submission.repository';

async function load(forms: FormRepository, id: string): Promise<Form> {
  const form = await forms.findById(id);
  if (!form) throw new FormNotFoundError();
  return form;
}

export interface FormWithCount {
  form: Form;
  submissions: number;
}

@Injectable()
export class ListFormsUseCase {
  constructor(
    @Inject(FORM_REPOSITORY) private readonly forms: FormRepository,
    @Inject(SUBMISSION_REPOSITORY) private readonly submissions: SubmissionRepository,
  ) {}

  async execute(): Promise<FormWithCount[]> {
    const forms = await this.forms.list();
    const counts = await this.submissions.countByForm(forms.map((f) => f.id));
    return forms.map((form) => ({ form, submissions: counts.get(form.id) ?? 0 }));
  }
}

@Injectable()
export class CreateFormUseCase {
  constructor(
    @Inject(FORM_REPOSITORY) private readonly forms: FormRepository,
    @Inject(PUBLIC_KEY_GENERATOR) private readonly keys: PublicKeyGenerator,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: FormSettings & { kind: string }): Promise<Form> {
    const form = Form.create(this.ids.generate(), {
      ...input,
      tenantId: this.tenant.tenantId,
      publicKey: this.keys.generate(),
    });
    await this.forms.save(form);
    return form;
  }
}

@Injectable()
export class UpdateFormUseCase {
  constructor(
    @Inject(FORM_REPOSITORY) private readonly forms: FormRepository,
    @Inject(PUBLIC_KEY_GENERATOR) private readonly keys: PublicKeyGenerator,
  ) {}

  /** `rotateKey`: gera chave nova (o HTML publicado com a antiga para de funcionar). */
  async execute(
    formId: string,
    changes: Partial<FormSettings> & { active?: boolean; rotateKey?: boolean },
  ): Promise<Form> {
    const form = await load(this.forms, formId);
    const { rotateKey, ...rest } = changes;
    form.update(rest);
    if (rotateKey) form.rotateKey(this.keys.generate());
    await this.forms.save(form);
    return form;
  }
}

/** Exclui o formulário e os envios dele (os contatos e negócios continuam). */
@Injectable()
export class DeleteFormUseCase {
  constructor(@Inject(FORM_REPOSITORY) private readonly forms: FormRepository) {}

  async execute(formId: string): Promise<void> {
    await this.forms.delete(await load(this.forms, formId));
  }
}

@Injectable()
export class ListFormSubmissionsUseCase {
  constructor(
    @Inject(FORM_REPOSITORY) private readonly forms: FormRepository,
    @Inject(SUBMISSION_REPOSITORY) private readonly submissions: SubmissionRepository,
  ) {}

  async execute(formId: string): Promise<FormSubmission[]> {
    const form = await load(this.forms, formId);
    return this.submissions.listByForm(form.id, 100);
  }
}

/** Envios de um contato (ficha), com o nome do formulário. */
@Injectable()
export class ListContactSubmissionsUseCase {
  constructor(
    @Inject(FORM_REPOSITORY) private readonly forms: FormRepository,
    @Inject(SUBMISSION_REPOSITORY) private readonly submissions: SubmissionRepository,
  ) {}

  async execute(contactId: string): Promise<{ submission: FormSubmission; formName: string }[]> {
    const submissions = await this.submissions.listByContact(contactId, 50);
    const names = new Map((await this.forms.list()).map((f) => [f.id, f.name]));
    return submissions.map((submission) => ({
      submission,
      formName: names.get(submission.formId) ?? 'Formulário excluído',
    }));
  }
}

export interface SubmitFormResult {
  /** Para onde mandar o visitante (null = a página de obrigado padrão). */
  successUrl: string | null;
}

/**
 * A chave pública da URL autentica o envio: diz o formulário e a conta. Usado
 * pelo guard da rota pública (que então fixa o tenant). Inexistente ou
 * trocada: 404, sem dizer mais nada.
 */
@Injectable()
export class AuthenticateFormKeyUseCase {
  constructor(@Inject(FORM_REPOSITORY) private readonly forms: FormRepository) {}

  async execute(publicKey: string): Promise<{ formId: string; tenantId: string }> {
    const form = await this.forms.findByPublicKeyAsSystem(publicKey);
    if (!form) throw new FormNotFoundError();
    return { formId: form.id, tenantId: form.tenantId };
  }
}

/**
 * Envio público de um formulário do site (sem login), já no tenant do
 * formulário (o guard resolveu a chave). O contato é registrado sem duplicar
 * (regras do contacts) e o envio fica guardado; os funis abrem o negócio
 * pelo `form.submitted.v1`.
 */
@Injectable()
export class SubmitFormUseCase {
  constructor(
    @Inject(FORM_REPOSITORY) private readonly forms: FormRepository,
    @Inject(SUBMISSION_REPOSITORY) private readonly submissions: SubmissionRepository,
    @Inject(LEAD_GATEWAY) private readonly leads: LeadGateway,
    @Inject(SERVICE_CATALOG) private readonly catalog: ServiceCatalog,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    formId: string,
    raw: Partial<Record<keyof SubmissionFields, string | null>>,
  ): Promise<SubmitFormResult> {
    const form = await load(this.forms, formId);
    if (!form.active) throw new InvalidFormError('FORM_INACTIVE');

    const fields = cleanFields(raw);
    // Serviço só no formulário de serviço, e só um que aparece no site.
    const service =
      form.kind === 'service' && fields.serviceId
        ? await this.catalog.siteService(fields.serviceId)
        : null;
    if (form.kind === 'service' && fields.serviceId && !service) {
      throw new InvalidFormError('FORM_UNKNOWN_SERVICE');
    }

    await this.unitOfWork.run(async () => {
      const { contactId } = await this.leads.capture({
        name: fields.name,
        phone: fields.phone,
        email: fields.email,
        campaign: form.sourceLabel,
      });
      const submission: FormSubmission = {
        ...fields,
        serviceId: service?.id ?? null,
        id: this.ids.generate(),
        tenantId: form.tenantId,
        formId: form.id,
        contactId,
        serviceName: service?.name ?? null,
        preferredDate: form.kind === 'service' ? fields.preferredDate : null,
        createdAt: new Date(),
      };
      await this.submissions.save(submission);
      await this.events.publish([
        new FormSubmittedEvent(
          submission.id,
          form.tenantId,
          form.id,
          form.kind,
          contactId,
          service && { id: service.id, name: service.name, priceCents: service.priceCents },
        ),
      ]);
    });
    return { successUrl: form.successUrl };
  }
}
