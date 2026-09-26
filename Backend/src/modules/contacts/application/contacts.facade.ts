import { Inject, Injectable } from '@nestjs/common';
import { CONTACT_REPOSITORY, type ContactRepository } from './ports/contact.repository';

/**
 * Dados de contato expostos a outros módulos — objetos simples, nunca a
 * entidade. Se o módulo virar um microsserviço, este é o formato que
 * trafegará pela rede.
 */
export interface ContactSummary {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * API síncrona do módulo para outros módulos (ex.: conversations buscando o
 * contato de uma conversa). Exportada pelo `index.ts`.
 */
@Injectable()
export class ContactsFacade {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository) {}

  async findById(id: string): Promise<ContactSummary | null> {
    const contact = await this.contacts.findById(id);
    if (!contact) return null;

    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone?.value ?? null,
      email: contact.email?.value ?? null,
    };
  }
}
