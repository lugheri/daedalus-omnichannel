import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import {
  TENANT_CONTEXT,
  type TenantContext,
} from '../../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { Contact } from '../../../domain/contact.entity';
import { ContactAlreadyExistsError } from '../../../domain/errors/contact-already-exists.error';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';
import type { CreateContactInput } from './create-contact.input';

@Injectable()
export class CreateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: CreateContactInput): Promise<Contact> {
    const contact = Contact.create(this.ids.generate(), {
      ...input,
      tenantId: this.tenant.tenantId,
    });

    // Contato e evento no outbox na mesma transação: ou os dois, ou nenhum.
    await this.unitOfWork.run(async () => {
      await this.ensureUnique(contact);
      await this.contacts.save(contact);
      await this.events.publish(contact.pullEvents());
    });

    return contact;
  }

  /**
   * Unicidade envolve outros contatos, então não cabe na entidade: é checada
   * aqui. A constraint única no banco cobre a corrida entre duas requisições
   * simultâneas (o repositório traduz a violação para o mesmo erro).
   */
  private async ensureUnique(contact: Contact): Promise<void> {
    if (contact.phone && (await this.contacts.findByPhone(contact.phone))) {
      throw new ContactAlreadyExistsError('phone');
    }
    if (contact.email && (await this.contacts.findByEmail(contact.email))) {
      throw new ContactAlreadyExistsError('email');
    }
  }
}
