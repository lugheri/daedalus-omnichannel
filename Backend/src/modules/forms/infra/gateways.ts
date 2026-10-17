import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CatalogFacade } from '../../catalog';
import { ContactsFacade } from '../../contacts';
import type { LeadGateway } from '../application/ports/lead-gateway';
import type { PublicKeyGenerator } from '../application/ports/public-key-generator';
import type { ServiceCatalog, SiteService } from '../application/ports/service-catalog';

/** Adapters dos ports do forms sobre as APIs públicas dos outros módulos. */

@Injectable()
export class ContactsLeadGateway implements LeadGateway {
  constructor(private readonly contacts: ContactsFacade) {}

  async capture(input: {
    name: string | null;
    phone: string | null;
    email: string | null;
    campaign: string;
  }): Promise<{ contactId: string }> {
    const { contact } = await this.contacts.captureFormLead(input);
    return { contactId: contact.id };
  }
}

@Injectable()
export class CatalogServiceGateway implements ServiceCatalog {
  constructor(private readonly catalog: CatalogFacade) {}

  siteService(id: string): Promise<SiteService | null> {
    return this.catalog.siteService(id);
  }
}

/** 18 bytes aleatórios = 24 caracteres base64url: impossível de adivinhar. */
export class RandomPublicKeyGenerator implements PublicKeyGenerator {
  generate(): string {
    return randomBytes(18).toString('base64url');
  }
}
