import type { CursorPage } from '../../../shared/application/pagination';
import type { TenantContext } from '../../../shared/application/tenant-context';
import type {
  AudienceCount,
  ContactFilter,
  ContactListQuery,
  ContactRepository,
  SourceDetailCount,
} from '../application/ports/contact.repository';
import type { Contact } from '../domain/contact.entity';
import type { Email } from '../domain/email.vo';
import { ContactAlreadyExistsError } from '../domain/errors/contact-already-exists.error';
import type { Phone } from '../domain/phone.vo';

/**
 * Repositório em memória para testes de use case. Reproduz o contrato do
 * repositório real: isolamento por tenant, unicidade e ordem (mais recentes
 * primeiro — aqui, pela ordem de inserção).
 */
export class InMemoryContactRepository implements ContactRepository {
  private readonly contacts: Contact[] = [];

  constructor(private readonly tenant: TenantContext) {}

  save(contact: Contact): Promise<void> {
    const others = this.ofTenant().filter((c) => c.id !== contact.id);
    if (contact.phone && others.some((c) => c.phone?.equals(contact.phone!))) {
      throw new ContactAlreadyExistsError('phone');
    }
    if (contact.email && others.some((c) => c.email?.equals(contact.email!))) {
      throw new ContactAlreadyExistsError('email');
    }

    const index = this.contacts.findIndex((c) => c.id === contact.id);
    if (index >= 0) this.contacts[index] = contact;
    else this.contacts.push(contact);
    return Promise.resolve();
  }

  findById(id: string): Promise<Contact | null> {
    return Promise.resolve(this.ofTenant().find((c) => c.id === id) ?? null);
  }

  findByIds(ids: string[]): Promise<Contact[]> {
    return Promise.resolve(this.ofTenant().filter((c) => ids.includes(c.id)));
  }

  findExistingIdentifiers(phones: string[], emails: string[]) {
    const mine = this.ofTenant();
    return Promise.resolve({
      phones: new Set(
        mine.flatMap((c) => (c.phone && phones.includes(c.phone.value) ? [c.phone.value] : [])),
      ),
      emails: new Set(
        mine.flatMap((c) => (c.email && emails.includes(c.email.value) ? [c.email.value] : [])),
      ),
    });
  }

  findByPhone(phone: Phone): Promise<Contact | null> {
    return Promise.resolve(this.ofTenant().find((c) => c.phone?.equals(phone)) ?? null);
  }

  findByEmail(email: Email): Promise<Contact | null> {
    return Promise.resolve(this.ofTenant().find((c) => c.email?.equals(email)) ?? null);
  }

  list({ limit, cursor, ...filter }: ContactListQuery): Promise<CursorPage<Contact>> {
    const newestFirst = this.matching(filter).reverse();
    const start = cursor ? newestFirst.findIndex((c) => c.id === cursor) + 1 : 0;
    const items = newestFirst.slice(start, start + limit);
    const hasMore = start + limit < newestFirst.length;

    return Promise.resolve({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
  }

  count(filter: ContactFilter): Promise<AudienceCount> {
    const found = this.matching(filter);
    return Promise.resolve({
      total: found.length,
      withEmail: found.filter((c) => c.email).length,
      withPhone: found.filter((c) => c.phone).length,
    });
  }

  listSourceDetails(): Promise<SourceDetailCount[]> {
    const counts = new Map<string, SourceDetailCount>();
    for (const c of this.ofTenant()) {
      if (!c.sourceDetail) continue;
      const key = `${c.source}|${c.sourceDetail}`;
      const entry = counts.get(key) ?? { source: c.source, detail: c.sourceDetail, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return Promise.resolve([...counts.values()]);
  }

  private matching({ search, source, sourceDetail }: ContactFilter): Contact[] {
    const term = search?.trim().toLowerCase();
    const digits = term?.replace(/\D/g, '') ?? '';
    return this.ofTenant()
      .filter((c) => !source || c.source === source)
      .filter((c) => !sourceDetail || c.sourceDetail?.toLowerCase() === sourceDetail.toLowerCase())
      .filter(
        (c) =>
          !term ||
          c.name?.toLowerCase().includes(term) ||
          c.email?.value.includes(term) ||
          (digits.length >= 3 && c.phone?.value.includes(digits)),
      );
  }

  private ofTenant(): Contact[] {
    const tenantId = this.tenant.tenantId;
    return this.contacts.filter((c) => c.tenantId === tenantId);
  }
}
