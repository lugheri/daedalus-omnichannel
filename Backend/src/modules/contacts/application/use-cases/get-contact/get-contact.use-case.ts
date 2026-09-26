import { Inject, Injectable } from '@nestjs/common';
import type { Contact } from '../../../domain/contact.entity';
import { ContactNotFoundError } from '../../../domain/errors/contact-not-found.error';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';

@Injectable()
export class GetContactUseCase {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository) {}

  async execute(id: string): Promise<Contact> {
    const contact = await this.contacts.findById(id);
    if (!contact) throw new ContactNotFoundError(id);
    return contact;
  }
}
