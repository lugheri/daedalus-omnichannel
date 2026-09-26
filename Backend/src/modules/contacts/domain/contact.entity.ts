import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Email } from './email.vo';
import { ContactWithoutIdentifierError } from './errors/contact-without-identifier.error';
import { ContactCreatedEvent } from './events/contact-created.event';
import { Phone } from './phone.vo';

export interface ContactProps {
  tenantId: string;
  name: string | null;
  phone: Phone | null;
  email: Email | null;
  createdAt: Date;
}

export interface CreateContactProps {
  tenantId: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export class Contact extends AggregateRoot<ContactProps> {
  /** Contato novo: valida as regras e registra `ContactCreatedEvent`. */
  static create(id: string, input: CreateContactProps): Contact {
    const phone = input.phone ? Phone.create(input.phone) : null;
    const email = input.email ? Email.create(input.email) : null;
    if (!phone && !email) throw new ContactWithoutIdentifierError();

    const contact = new Contact(id, {
      tenantId: input.tenantId,
      name: input.name?.trim() || null,
      phone,
      email,
      createdAt: new Date(),
    });
    contact.addEvent(new ContactCreatedEvent(id, input.tenantId));
    return contact;
  }

  /** Contato já existente, vindo da persistência: sem validação e sem evento. */
  static restore(id: string, props: ContactProps): Contact {
    return new Contact(id, props);
  }

  get tenantId() {
    return this.props.tenantId;
  }

  get name() {
    return this.props.name;
  }

  get phone() {
    return this.props.phone;
  }

  get email() {
    return this.props.email;
  }

  get createdAt() {
    return this.props.createdAt;
  }
}
