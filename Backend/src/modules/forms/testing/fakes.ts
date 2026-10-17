import type { TenantContext } from '../../../shared/application/tenant-context';
import type { FormRepository } from '../application/ports/form.repository';
import type { LeadGateway } from '../application/ports/lead-gateway';
import type { PublicKeyGenerator } from '../application/ports/public-key-generator';
import type { ServiceCatalog, SiteService } from '../application/ports/service-catalog';
import type { SubmissionRepository } from '../application/ports/submission.repository';
import { Form } from '../domain/form.entity';
import type { FormSubmission } from '../domain/submission';

const copy = (f: Form) =>
  Form.restore(f.id, {
    tenantId: f.tenantId,
    name: f.name,
    kind: f.kind,
    publicKey: f.publicKey,
    campaign: f.campaign,
    successUrl: f.successUrl,
    active: f.active,
    createdAt: f.createdAt,
  });

/** Reproduz o repositório real: isolado por tenant (menos a busca pela chave). */
export class InMemoryFormRepository implements FormRepository {
  items: Form[] = [];

  constructor(
    private readonly tenant: TenantContext,
    /** Apagar o formulário leva os envios (como o CASCADE). */
    private readonly submissions?: InMemorySubmissionRepository,
  ) {}

  private ofTenant() {
    return this.items.filter((f) => f.tenantId === this.tenant.tenantId);
  }

  save(form: Form): Promise<void> {
    this.items = [...this.items.filter((f) => f.id !== form.id), copy(form)];
    return Promise.resolve();
  }

  findById(id: string): Promise<Form | null> {
    const form = this.ofTenant().find((f) => f.id === id);
    return Promise.resolve(form ? copy(form) : null);
  }

  list(): Promise<Form[]> {
    return Promise.resolve(this.ofTenant().reverse().map(copy));
  }

  delete(form: Form): Promise<void> {
    this.items = this.items.filter((f) => f.id !== form.id);
    this.submissions?.removeForm(form.id);
    return Promise.resolve();
  }

  findByPublicKeyAsSystem(publicKey: string): Promise<Form | null> {
    const form = this.items.find((f) => f.publicKey === publicKey);
    return Promise.resolve(form ? copy(form) : null);
  }
}

export class InMemorySubmissionRepository implements SubmissionRepository {
  items: FormSubmission[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.items.filter((s) => s.tenantId === this.tenant.tenantId);
  }

  removeForm(formId: string) {
    this.items = this.items.filter((s) => s.formId !== formId);
  }

  save(submission: FormSubmission): Promise<void> {
    this.items.push({ ...submission });
    return Promise.resolve();
  }

  listByForm(formId: string, limit: number): Promise<FormSubmission[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((s) => s.formId === formId)
        .reverse()
        .slice(0, limit),
    );
  }

  listByContact(contactId: string, limit: number): Promise<FormSubmission[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((s) => s.contactId === contactId)
        .reverse()
        .slice(0, limit),
    );
  }

  countByForm(formIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const s of this.ofTenant()) {
      if (formIds.includes(s.formId)) counts.set(s.formId, (counts.get(s.formId) ?? 0) + 1);
    }
    return Promise.resolve(counts);
  }
}

/** Um contato por telefone ou e-mail (como o contacts: não duplica). */
export class FakeLeadGateway implements LeadGateway {
  readonly captured: {
    name: string | null;
    phone: string | null;
    email: string | null;
    campaign: string;
  }[] = [];
  private readonly byKey = new Map<string, string>();

  capture(input: {
    name: string | null;
    phone: string | null;
    email: string | null;
    campaign: string;
  }) {
    if (!input.phone && !input.email) {
      return Promise.reject(
        Object.assign(new Error('no id'), { code: 'CONTACT_WITHOUT_IDENTIFIER' }),
      );
    }
    this.captured.push(input);
    const key = input.phone ?? input.email!;
    if (!this.byKey.has(key)) this.byKey.set(key, `contact-${this.byKey.size + 1}`);
    return Promise.resolve({ contactId: this.byKey.get(key)! });
  }
}

export class FakeServiceCatalog implements ServiceCatalog {
  constructor(private readonly services: SiteService[] = []) {}

  siteService(id: string): Promise<SiteService | null> {
    return Promise.resolve(this.services.find((s) => s.id === id) ?? null);
  }
}

export class SequentialKeys implements PublicKeyGenerator {
  private n = 0;
  generate(): string {
    this.n += 1;
    return `key-${this.n}`;
  }
}
