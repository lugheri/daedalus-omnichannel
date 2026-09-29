import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage } from '../../../../../shared/application/pagination';
import type { Contact } from '../../../domain/contact.entity';
import {
  CONTACT_REPOSITORY,
  type ContactListQuery,
  type ContactRepository,
} from '../../ports/contact.repository';

@Injectable()
export class ListContactsUseCase {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository) {}

  execute(query: ContactListQuery): Promise<CursorPage<Contact>> {
    return this.contacts.list(query);
  }
}
