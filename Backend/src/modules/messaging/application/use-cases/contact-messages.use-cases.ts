import { Inject, Injectable } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../../shared/application/actor-context';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { ContactWithoutAddressError } from '../../domain/errors/contact-without-address.error';
import { MessagingContactNotFoundError } from '../../domain/errors/messaging-contact-not-found.error';
import { MessagingNotConfiguredError } from '../../domain/errors/messaging-not-configured.error';
import { OptedOutError } from '../../domain/errors/opted-out.error';
import type { MessagingChannel } from '../../domain/messaging-provider.entity';
import type { OptOut } from '../../domain/opt-out';
import { OutboundMessage } from '../../domain/outbound-message.entity';
import { DeliverOutboundJob } from '../messaging-jobs';
import {
  CONTACT_DIRECTORY,
  type ContactDirectory,
  type MessagingContact,
} from '../ports/contact-directory';
import {
  MESSAGING_PROVIDER_REPOSITORY,
  type MessagingProviderRepository,
} from '../ports/messaging-provider.repository';
import { OPT_OUT_REPOSITORY, type OptOutRepository } from '../ports/opt-out.repository';
import {
  OUTBOUND_MESSAGE_REPOSITORY,
  type OutboundMessageRepository,
} from '../ports/outbound-message.repository';

/** Endereço do contato no canal (e-mail ou telefone), ou null. */
export function addressOf(contact: MessagingContact, channel: MessagingChannel): string | null {
  return channel === 'email' ? contact.email : contact.phone;
}

/**
 * Quais canais a conta pode usar (tem provedor configurado). Para quem envia
 * pela ficha — sem expor configuração nem credenciais.
 */
@Injectable()
export class GetAvailableChannelsUseCase {
  constructor(
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
  ) {}

  async execute(): Promise<Record<MessagingChannel, boolean>> {
    const configured = new Set((await this.providers.list()).map((p) => p.channel));
    return { email: configured.has('email'), sms: configured.has('sms') };
  }
}

/**
 * Envio individual pela ficha do contato (`messaging:send`). Grava na fila
 * e responde na hora; o worker entrega ao provedor.
 */
@Injectable()
export class SendToContactUseCase {
  constructor(
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: {
    contactId: string;
    channel: MessagingChannel;
    subject?: string | null;
    body: string;
  }): Promise<OutboundMessage> {
    const contact = await this.contacts.findById(input.contactId);
    if (!contact) throw new MessagingContactNotFoundError();
    const to = addressOf(contact, input.channel);
    if (!to) throw new ContactWithoutAddressError();
    if (!(await this.providers.findByChannel(input.channel))) {
      throw new MessagingNotConfiguredError();
    }
    if (await this.optOuts.isOptedOut(input.channel, to)) throw new OptedOutError();

    const message = OutboundMessage.compose(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      channel: input.channel,
      contactId: contact.id,
      to,
      subject: input.subject,
      body: input.body,
      sentByMembershipId: this.actors.actor.membershipId,
      campaignId: null,
    });
    // Grava e só então enfileira: o job nunca procura uma mensagem que não existe.
    await this.unitOfWork.run(() => this.messages.save(message));
    await this.jobs.add(
      DeliverOutboundJob,
      { messageId: message.id },
      { jobId: `deliver:${message.id}` },
    );
    return message;
  }
}

/** Histórico de e-mails/SMS enviados ao contato. */
@Injectable()
export class ListContactMessagesUseCase {
  constructor(
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
  ) {}

  execute(contactId: string): Promise<OutboundMessage[]> {
    return this.messages.listByContact(contactId, 50);
  }
}

/** Descadastros que valem para os endereços atuais do contato. */
@Injectable()
export class ListContactOptOutsUseCase {
  constructor(
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
  ) {}

  async execute(contactId: string): Promise<OptOut[]> {
    const contact = await this.contacts.findById(contactId);
    if (!contact) throw new MessagingContactNotFoundError();
    const addresses = (['email', 'sms'] as const).flatMap((channel) => {
      const address = addressOf(contact, channel);
      return address ? [{ channel, address }] : [];
    });
    return addresses.length ? this.optOuts.listFor(addresses) : [];
  }
}

/**
 * Reativar um endereço descadastrado (`messaging:manage`) — só a pedido do
 * próprio contato; a tela avisa isso.
 */
@Injectable()
export class RemoveContactOptOutUseCase {
  constructor(
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
  ) {}

  async execute(contactId: string, channel: MessagingChannel): Promise<void> {
    const contact = await this.contacts.findById(contactId);
    if (!contact) throw new MessagingContactNotFoundError();
    const address = addressOf(contact, channel);
    if (address) await this.optOuts.remove(channel, address);
  }
}
