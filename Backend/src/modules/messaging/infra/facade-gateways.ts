import { Injectable } from '@nestjs/common';
import { ContactsFacade, LEAD_SOURCES, type ContactFilter } from '../../contacts';
import type {
  AudienceFilter,
  ContactDirectory,
  MessagingContact,
} from '../application/ports/contact-directory';

/** Adapter do port de contatos sobre a API pública do módulo contacts. */
@Injectable()
export class ContactsFacadeDirectory implements ContactDirectory {
  constructor(private readonly contacts: ContactsFacade) {}

  findById(id: string): Promise<MessagingContact | null> {
    return this.contacts.findById(id);
  }

  findByIds(ids: string[]): Promise<MessagingContact[]> {
    return this.contacts.findByIds(ids);
  }

  audiencePage(filter: AudienceFilter, page: { cursor?: string; limit: number }) {
    return this.contacts.audiencePage(toContactFilter(filter), page);
  }

  countAudience(filter: AudienceFilter) {
    return this.contacts.countAudience(toContactFilter(filter));
  }
}

/** A origem só vale se for uma das conhecidas (senão, o filtro ignora). */
function toContactFilter(filter: AudienceFilter): ContactFilter {
  const source = LEAD_SOURCES.find((s) => s === filter.source);
  return {
    ...(filter.search && { search: filter.search }),
    ...(source && { source }),
    ...(filter.sourceDetail && { sourceDetail: filter.sourceDetail }),
  };
}
