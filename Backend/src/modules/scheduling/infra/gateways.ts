import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AccountsFacade } from '../../accounts';
import { CatalogFacade } from '../../catalog';
import { ContactsFacade } from '../../contacts';
import type {
  AgendaProfessional,
  AgendaService,
  BookingKeyGenerator,
  SchedulingCatalog,
  SchedulingContacts,
  SchedulingMembers,
} from '../application/ports/scheduling-sources';

/** Adapters dos ports da agenda sobre as facades dos outros módulos. */

@Injectable()
export class CatalogSchedulingCatalog implements SchedulingCatalog {
  constructor(private readonly catalog: CatalogFacade) {}

  async load(): Promise<{ services: AgendaService[]; professionals: AgendaProfessional[] }> {
    const { offerings, professionals } = await this.catalog.agendaCatalog();
    return { services: offerings, professionals };
  }
}

@Injectable()
export class ContactsSchedulingContacts implements SchedulingContacts {
  constructor(private readonly contacts: ContactsFacade) {}

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return (await this.contacts.findByIds(ids)).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
    }));
  }

  async captureBookingLead(input: { name: string; phone: string | null; email: string | null }) {
    const { contact } = await this.contacts.captureBookingLead(input);
    return { contactId: contact.id };
  }
}

@Injectable()
export class AccountsSchedulingMembers implements SchedulingMembers {
  constructor(private readonly accounts: AccountsFacade) {}

  async currentMembershipId(): Promise<string> {
    return (await this.accounts.currentMember()).membershipId;
  }
}

@Injectable()
export class RandomBookingKeyGenerator implements BookingKeyGenerator {
  generate(): string {
    return randomBytes(18).toString('base64url');
  }
}
