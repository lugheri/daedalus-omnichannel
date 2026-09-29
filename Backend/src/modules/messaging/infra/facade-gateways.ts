import { Injectable } from '@nestjs/common';
import { ContactsFacade } from '../../contacts';
import type { ContactDirectory, MessagingContact } from '../application/ports/contact-directory';

/** Adapter do port de contatos sobre a API pública do módulo contacts. */
@Injectable()
export class ContactsFacadeDirectory implements ContactDirectory {
  constructor(private readonly contacts: ContactsFacade) {}

  findById(id: string): Promise<MessagingContact | null> {
    return this.contacts.findById(id);
  }
}
