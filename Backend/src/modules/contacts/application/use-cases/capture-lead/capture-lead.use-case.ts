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
import { LeadCapturedEvent } from '../../../domain/events/lead-captured.event';
import type { LeadSource } from '../../../domain/lead-source';
import { Phone } from '../../../domain/phone.vo';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';

export interface CaptureLeadInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Campanha / página do formulário → `sourceDetail`. */
  campaign?: string | null;
  /** Origem de contato novo (padrão: formulário do site). */
  source?: LeadSource;
}

/**
 * Lead vindo do formulário do site (API com chave da conta).
 *
 * - Novo: contato com origem `web_form` e a campanha.
 * - Sempre publica `LeadCapturedEvent` (os funis abrem o negócio).
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

  /**
   * `announce: false`: não publica `LeadCapturedEvent` — quem chamou avisa do
   * jeito dele (ex.: o formulário do site, com o serviço escolhido).
   */
  async execute(
    input: CaptureLeadInput,
    { announce = true }: { announce?: boolean } = {},
  ): Promise<{ contact: Contact; created: boolean }> {
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
        if (announce) await this.events.publish([this.captured(existing, input, false)]);
        return { contact: existing, created: false };
      }

      const contact = Contact.create(this.ids.generate(), {
        tenantId: this.tenant.tenantId,
        name: input.name,
        phone: phone?.value,
        email: email?.value,
        source: input.source ?? 'web_form',
        sourceDetail: input.campaign,
      });
      await this.contacts.save(contact);
      await this.events.publish([
        ...contact.pullEvents(),
        ...(announce ? [this.captured(contact, input, true)] : []),
      ]);
      return { contact, created: true };
    });
  }

  private captured(contact: Contact, input: CaptureLeadInput, newContact: boolean) {
    const campaign = input.campaign?.trim() || null;
    return new LeadCapturedEvent(contact.id, this.tenant.tenantId, campaign, newContact);
  }
}
