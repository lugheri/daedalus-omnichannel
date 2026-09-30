import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage } from '../../../../../shared/application/pagination';
import type { Contact } from '../../../domain/contact.entity';
import {
  CONTACT_REPOSITORY,
  type ContactListQuery,
  type ContactRepository,
  type SourceDetailCount,
} from '../../ports/contact.repository';

@Injectable()
export class ListContactsUseCase {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository) {}

  execute(query: ContactListQuery): Promise<CursorPage<Contact>> {
    return this.contacts.list(query);
  }
}

/** Detalhes de origem em uso (para filtrar por campanha do site ou lote importado). */
@Injectable()
export class ListSourceDetailsUseCase {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository) {}

  execute(): Promise<SourceDetailCount[]> {
    return this.contacts.listSourceDetails();
  }
}
