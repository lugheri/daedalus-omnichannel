import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work';
import { Contact } from '../domain/contact.entity';
import { Phone } from '../domain/phone.vo';
import {
  CONTACT_REPOSITORY,
  type AudienceCount,
  type ContactFilter,
  type ContactRepository,
} from './ports/contact.repository';

export type { AudienceCount, ContactFilter };

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
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async findById(id: string): Promise<ContactSummary | null> {
    const contact = await this.contacts.findById(id);
    return contact ? summarize(contact) : null;
  }

  /** Público de campanha: uma página dos contatos que casam com o filtro. */
  async audiencePage(
    filter: ContactFilter,
    page: { cursor?: string; limit: number },
  ): Promise<{ items: ContactSummary[]; nextCursor: string | null }> {
    const result = await this.contacts.list({ ...filter, ...page });
    return { items: result.items.map(summarize), nextCursor: result.nextCursor };
  }

  countAudience(filter: ContactFilter): Promise<AudienceCount> {
    return this.contacts.count(filter);
  }

  async findByIds(ids: string[]): Promise<ContactSummary[]> {
    if (ids.length === 0) return [];
    return (await this.contacts.findByIds([...new Set(ids)])).map(summarize);
  }

  /**
   * O contato com este telefone; se não existir, cria com origem `whatsapp`
   * (primeira mensagem de um cliente). Lança `InvalidPhoneError` para telefone inválido.
   * Participa da transação em andamento, se houver.
   */
  async findOrCreateByPhone(input: {
    phone: string;
    name: string | null;
  }): Promise<ContactSummary> {
    const existing = await this.contacts.findByPhone(Phone.create(input.phone));
    if (existing) return summarize(existing);

    const contact = Contact.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      name: input.name,
      phone: input.phone,
      source: 'whatsapp',
    });
    await this.unitOfWork.run(async () => {
      await this.contacts.save(contact);
      await this.events.publish(contact.pullEvents());
    });
    return summarize(contact);
  }
}

function summarize(contact: Contact): ContactSummary {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone?.value ?? null,
    email: contact.email?.value ?? null,
  };
}
