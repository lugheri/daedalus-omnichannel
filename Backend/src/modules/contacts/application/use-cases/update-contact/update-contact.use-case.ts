import { Inject, Injectable } from '@nestjs/common';
import type { Contact, UpdateContactProps } from '../../../domain/contact.entity';
import { ContactAlreadyExistsError } from '../../../domain/errors/contact-already-exists.error';
import { ContactNotFoundError } from '../../../domain/errors/contact-not-found.error';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';

/** Edição de nome, telefone e e-mail (a origem não muda: é histórico). */
@Injectable()
export class UpdateContactUseCase {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository) {}

  async execute(input: { id: string } & UpdateContactProps): Promise<Contact> {
    const contact = await this.contacts.findById(input.id);
    if (!contact) throw new ContactNotFoundError(input.id);

    contact.update(input);
    await this.ensureUnique(contact);
    await this.contacts.save(contact);
    return contact;
  }

  /** Telefone/e-mail não podem ser de OUTRO contato (a constraint cobre a corrida). */
  private async ensureUnique(contact: Contact): Promise<void> {
    const byPhone = contact.phone && (await this.contacts.findByPhone(contact.phone));
    if (byPhone && byPhone.id !== contact.id) throw new ContactAlreadyExistsError('phone');
    const byEmail = contact.email && (await this.contacts.findByEmail(contact.email));
    if (byEmail && byEmail.id !== contact.id) throw new ContactAlreadyExistsError('email');
  }
}
