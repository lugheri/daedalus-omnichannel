import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage, PageRequest } from '../../../../../shared/application/pagination';
import type { Contact } from '../../../domain/contact.entity';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';

@Injectable()
export class ListContactsUseCase {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository) {}

  execute(page: PageRequest): Promise<CursorPage<Contact>> {
    return this.contacts.list(page);
  }
}
