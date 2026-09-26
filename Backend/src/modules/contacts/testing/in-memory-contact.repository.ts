import type { CursorPage, PageRequest } from '../../../shared/application/pagination';
import type { TenantContext } from '../../../shared/application/tenant-context';
import type { ContactRepository } from '../application/ports/contact.repository';
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

  findByPhone(phone: Phone): Promise<Contact | null> {
    return Promise.resolve(this.ofTenant().find((c) => c.phone?.equals(phone)) ?? null);
  }

  findByEmail(email: Email): Promise<Contact | null> {
    return Promise.resolve(this.ofTenant().find((c) => c.email?.equals(email)) ?? null);
  }

  list({ limit, cursor }: PageRequest): Promise<CursorPage<Contact>> {
    const newestFirst = this.ofTenant().reverse();
    const start = cursor ? newestFirst.findIndex((c) => c.id === cursor) + 1 : 0;
    const items = newestFirst.slice(start, start + limit);
    const hasMore = start + limit < newestFirst.length;

    return Promise.resolve({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
  }

  private ofTenant(): Contact[] {
    const tenantId = this.tenant.tenantId;
    return this.contacts.filter((c) => c.tenantId === tenantId);
  }
}
