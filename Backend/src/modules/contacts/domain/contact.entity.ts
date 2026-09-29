import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Email } from './email.vo';
import { ContactWithoutIdentifierError } from './errors/contact-without-identifier.error';
import { ContactCreatedEvent } from './events/contact-created.event';
import { sourceDetailOf, type LeadSource } from './lead-source';
import { Phone } from './phone.vo';

export interface ContactProps {
  tenantId: string;
  name: string | null;
  phone: Phone | null;
  email: Email | null;
  source: LeadSource;
  sourceDetail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactProps {
  tenantId: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Padrão: `manual`. */
  source?: LeadSource;
  sourceDetail?: string | null;
}

export interface UpdateContactProps {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export class Contact extends AggregateRoot<ContactProps> {
  /** Contato novo: valida as regras e registra `ContactCreatedEvent`. */
  static create(id: string, input: CreateContactProps): Contact {
    const { phone, email } = identifiers(input.phone, input.email);
    const now = new Date();

    const contact = new Contact(id, {
      tenantId: input.tenantId,
      name: nameOf(input.name),
      phone,
      email,
      source: input.source ?? 'manual',
      sourceDetail: sourceDetailOf(input.sourceDetail),
      createdAt: now,
      updatedAt: now,
    });
    contact.addEvent(new ContactCreatedEvent(id, input.tenantId));
    return contact;
  }

  /** Contato já existente, vindo da persistência: sem validação e sem evento. */
  static restore(id: string, props: ContactProps): Contact {
    return new Contact(id, props);
  }

  /**
   * Edição: campos ausentes não mudam; `null`/vazio apaga. As mesmas regras
   * da criação valem (telefone/e-mail válidos, ao menos um dos dois). A
   * origem não é editável — é histórico de como o lead chegou.
   */
  update(input: UpdateContactProps): void {
    const { phone, email } = identifiers(
      input.phone === undefined ? this.props.phone?.value : input.phone,
      input.email === undefined ? this.props.email?.value : input.email,
    );
    if (input.name !== undefined) this.props.name = nameOf(input.name);
    this.props.phone = phone;
    this.props.email = email;
    this.props.updatedAt = new Date();
  }

  /**
   * Completa só o que está EM BRANCO (ex.: um formulário trouxe o e-mail de
   * quem só tinha telefone). Nunca sobrescreve dado existente nem a origem.
   * Devolve se algo mudou.
   */
  fillBlanks(input: { name?: string | null; phone?: Phone | null; email?: Email | null }): boolean {
    let changed = false;
    const name = nameOf(input.name);
    if (!this.props.name && name) {
      this.props.name = name;
      changed = true;
    }
    if (!this.props.phone && input.phone) {
      this.props.phone = input.phone;
      changed = true;
    }
    if (!this.props.email && input.email) {
      this.props.email = input.email;
      changed = true;
    }
    if (changed) this.props.updatedAt = new Date();
    return changed;
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

  get source() {
    return this.props.source;
  }

  get sourceDetail() {
    return this.props.sourceDetail;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }
}

function nameOf(raw: string | null | undefined): string | null {
  return raw?.trim() || null;
}

function identifiers(rawPhone: string | null | undefined, rawEmail: string | null | undefined) {
  const phone = rawPhone ? Phone.create(rawPhone) : null;
  const email = rawEmail ? Email.create(rawEmail) : null;
  if (!phone && !email) throw new ContactWithoutIdentifierError();
  return { phone, email };
}
