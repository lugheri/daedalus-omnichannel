import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import {
  TENANT_CONTEXT,
  type TenantContext,
} from '../../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { Contact } from '../../../domain/contact.entity';
import { Email } from '../../../domain/email.vo';
import { ContactWithoutIdentifierError } from '../../../domain/errors/contact-without-identifier.error';
import { Phone } from '../../../domain/phone.vo';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';

export interface CaptureLeadInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Campanha / página do formulário → `sourceDetail`. */
  campaign?: string | null;
}

/**
 * Lead vindo do formulário do site (API com chave da conta).
 *
 * - Novo: contato com origem `web_form` e a campanha.
 * - Já existe (mesmo telefone ou e-mail): NÃO duplica — completa o que estiver
 *   em branco (se o dado não for de outro contato) e mantém a origem original,
 *   que registra como o lead chegou pela PRIMEIRA vez. Reenviar o formulário
 *   não tem efeito colateral.
 */
@Injectable()
export class CaptureLeadUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: CaptureLeadInput): Promise<{ contact: Contact; created: boolean }> {
    const phone = input.phone ? Phone.create(input.phone) : null;
    const email = input.email ? Email.create(input.email) : null;
    if (!phone && !email) throw new ContactWithoutIdentifierError();

    return this.unitOfWork.run(async () => {
      const byPhone = phone && (await this.contacts.findByPhone(phone));
      const byEmail = email && (await this.contacts.findByEmail(email));
      const existing = byPhone || byEmail;

      if (existing) {
        const changed = existing.fillBlanks({
          name: input.name,
          // Só completa com dado que não seja de OUTRO contato.
          phone: byPhone ? null : phone,
          email: byEmail && byEmail.id !== existing.id ? null : email,
        });
        if (changed) await this.contacts.save(existing);
        return { contact: existing, created: false };
      }

      const contact = Contact.create(this.ids.generate(), {
        tenantId: this.tenant.tenantId,
        name: input.name,
        phone: phone?.value,
        email: email?.value,
        source: 'web_form',
        sourceDetail: input.campaign,
      });
      await this.contacts.save(contact);
      await this.events.publish(contact.pullEvents());
      return { contact, created: true };
    });
  }
}
