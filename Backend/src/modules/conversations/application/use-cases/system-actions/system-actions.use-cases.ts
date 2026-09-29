import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { ContactWithoutPhoneError } from '../../../domain/errors/contact-without-phone.error';
import { ConversationNotFoundError } from '../../../domain/errors/conversation-not-found.error';
import { Message } from '../../../domain/message.entity';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../../ports/contact-directory';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { MEMBER_ACCESS, type MemberAccess } from '../../ports/member-access';
import { TEAM_DIRECTORY, type TeamDirectory } from '../../ports/team-directory';
import { TextDelivery } from '../../text-delivery';
import {
  applyTransfer,
  type TransferInput,
} from '../assign-conversation/assign-conversation.use-cases';

/*
 * Ações do sistema sobre conversas (automações do kanban, no worker): sem
 * membro por trás, então sem escopo de visibilidade — só o tenant. Nunca
 * expostas por HTTP; só pela facade.
 */

@Injectable()
export class SendAutomatedMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly delivery: TextDelivery,
  ) {}

  async execute(input: { conversationId: string; text: string }): Promise<Message> {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    const contact = await this.contacts.findById(conversation.contactId);
    if (!contact?.phone) throw new ContactWithoutPhoneError();
    await this.channels.assertCanSend(conversation.channelId);

    const message = Message.automated(this.ids.generate(), {
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      channelId: conversation.channelId,
      text: input.text,
    });
    return this.delivery.deliver(conversation, message, contact.phone);
  }
}

/** Atribuição pelo sistema: as mesmas regras da transferência, sem escopo. */
@Injectable()
export class AssignBySystemUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
    @Inject(MEMBER_ACCESS) private readonly members: MemberAccess,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: TransferInput & { conversationId: string }): Promise<void> {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    await applyTransfer(conversation, input, this.teams, this.members);
    await this.unitOfWork.run(async () => {
      await this.conversations.save(conversation);
      await this.events.publish(conversation.pullEvents());
    });
  }
}
