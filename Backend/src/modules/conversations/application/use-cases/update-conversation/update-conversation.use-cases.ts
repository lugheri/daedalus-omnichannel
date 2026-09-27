import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import type { ConversationStatus } from '../../../domain/conversation.entity';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { VisibleConversations } from '../../visible-conversations';

/** Aberta, pendente (aguardando o cliente) ou resolvida. */
@Injectable()
export class ChangeConversationStatusUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(input: { conversationId: string; status: ConversationStatus }): Promise<void> {
    const { conversation } = await this.visible.load(input.conversationId);
    conversation.changeStatus(input.status);
    await this.unitOfWork.run(async () => {
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
