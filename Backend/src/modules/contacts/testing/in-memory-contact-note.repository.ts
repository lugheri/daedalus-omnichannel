import type { TenantContext } from '../../../shared/application/tenant-context';
import type { ContactNoteRepository } from '../application/ports/contact-note.repository';
import type { ContactNote } from '../domain/contact-note.entity';

/** Reproduz o repositório real: isolado por tenant, mais recentes primeiro. */
export class InMemoryContactNoteRepository implements ContactNoteRepository {
  private notes: ContactNote[] = [];

  constructor(private readonly tenant: TenantContext) {}

  private ofTenant() {
    return this.notes.filter((n) => n.tenantId === this.tenant.tenantId);
  }

  save(note: ContactNote): Promise<void> {
    this.notes = [...this.notes.filter((n) => n.id !== note.id), note];
    return Promise.resolve();
  }

  findById(id: string): Promise<ContactNote | null> {
    return Promise.resolve(this.ofTenant().find((n) => n.id === id) ?? null);
  }

  listByContact(contactId: string): Promise<ContactNote[]> {
    return Promise.resolve(
      this.ofTenant()
        .filter((n) => n.contactId === contactId)
        .reverse(),
    );
  }

  delete(note: ContactNote): Promise<void> {
    this.notes = this.notes.filter((n) => n.id !== note.id);
    return Promise.resolve();
  }
}
