import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import {
  TENANT_CONTEXT,
  type TenantContext,
} from '../../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { Conversation } from '../../../domain/conversation.entity';
import { Message, type MessageKind } from '../../../domain/message.entity';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../../ports/contact-directory';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { MESSAGE_REPOSITORY, type MessageRepository } from '../../ports/message.repository';

export interface ChannelMessageInput {
  channelId: string;
  externalId: string;
  contactPhone: string | null;
  contactName: string | null;
  fromMe: boolean;
  kind: MessageKind;
  text: string | null;
  sentAt: string;
}

export type RecordResult = 'recorded' | 'duplicate' | 'skipped';

/**
 * Mensagem que passou pelo canal (evento do módulo channels, no worker):
 * acha ou cria o contato pelo telefone, acha ou abre a conversa e registra a
 * mensagem — tudo numa transação.
 *
 * Idempotente pelo id do provedor: a mesma mensagem entregue duas vezes é
 * registrada uma vez. Numa corrida (duas entregas simultâneas), a constraint
 * única do banco barra a segunda; o retry da fila a encontra já registrada.
 */
@Injectable()
export class RecordChannelMessageUseCase {
  private readonly logger = new Logger(RecordChannelMessageUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: ChannelMessageInput): Promise<RecordResult> {
    if (!input.contactPhone) {
      // Contatos identificados só por LID (sem telefone) ainda não são
      // suportados: o contato precisa de telefone para ser respondido.
      this.logger.warn(`Mensagem ${input.externalId} sem telefone do contato; ignorada`);
      return 'skipped';
    }
    const phone = input.contactPhone;

    return this.unitOfWork.run(async () => {
      if (await this.messages.existsByExternalId(input.channelId, input.externalId)) {
        return 'duplicate';
      }

      const contact = await this.contacts.findOrCreateByPhone({
        phone,
        name: input.fromMe ? null : input.contactName,
      });
      const conversation =
        (await this.conversations.findByChannelAndContact(input.channelId, contact.id)) ??
        (await this.startConversation(input.channelId, contact.id));

      const data = {
        tenantId: this.tenant.tenantId,
        conversationId: conversation.id,
        channelId: input.channelId,
        externalId: input.externalId,
        kind: input.kind,
        text: input.text,
        sentAt: new Date(input.sentAt),
      };
      const message = input.fromMe
        ? Message.sentFromPhone(this.ids.generate(), data)
        : Message.inbound(this.ids.generate(), data);
      conversation.addMessage(message);

      await this.conversations.save(conversation);
      await this.messages.save(message);
      await this.events.publish([...conversation.pullEvents(), ...message.pullEvents()]);
      return 'recorded';
    });
  }

  /** Conversa nova entra na fila da equipe do canal (ou na fila geral). */
  private async startConversation(channelId: string, contactId: string): Promise<Conversation> {
    const [channel] = await this.channels.findByIds([channelId]);
    return Conversation.start(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      channelId,
      contactId,
      teamId: channel?.teamId ?? null,
    });
  }
}
