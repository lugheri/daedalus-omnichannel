import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import type { ConversationStatus } from '../../../domain/conversation.entity';
import { ConversationTabulator, type TabulationInput } from '../../conversation-tabulator';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { VisibleConversations } from '../../visible-conversations';

/**
 * Aberta, pendente (aguardando o cliente) ou resolvida. Ao resolver, pode
 * vir junto a tabulação — obrigatória se a conta tem tabulações ativas e o
 * atendimento ainda não foi tabulado.
 */
@Injectable()
export class ChangeConversationStatusUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly visible: VisibleConversations,
    private readonly tabulator: ConversationTabulator,
  ) {}

  async execute(input: {
    conversationId: string;
    status: ConversationStatus;
    disposition?: TabulationInput;
  }): Promise<void> {
    const { conversation, member } = await this.visible.load(input.conversationId);
    await this.unitOfWork.run(async () => {
      if (input.status === 'resolved' && conversation.status !== 'resolved') {
        if (input.disposition) {
          await this.tabulator.apply(conversation, member.membershipId, input.disposition);
        } else {
          await this.tabulator.assertCanResolve(conversation);
        }
      }
      conversation.changeStatus(input.status);
      await this.conversations.save(conversation);
      await this.events.publish(conversation.pullEvents());
    });
  }
}

/** O membro abriu a conversa: zera o contador de não lidas. */
@Injectable()
export class MarkConversationReadUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(conversationId: string): Promise<void> {
    const { conversation } = await this.visible.load(conversationId);
    if (conversation.unreadCount === 0) return;
    conversation.markRead();
    await this.conversations.save(conversation);
  }
}
