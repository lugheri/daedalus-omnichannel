import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import type { ConversationDisposition } from '../../../domain/conversation-disposition.entity';
import { ConversationTabulator, type TabulationInput } from '../../conversation-tabulator';
import {
  CONVERSATION_DISPOSITION_REPOSITORY,
  type ConversationDispositionRepository,
} from '../../ports/conversation-disposition.repository';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { VisibleConversations } from '../../visible-conversations';

/**
 * Tabula o atendimento, a qualquer momento (ex.: "Proposta enviada" no meio
 * da conversa). Quem vê a conversa pode tabulá-la.
 */
@Injectable()
export class TabulateConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly visible: VisibleConversations,
    private readonly tabulator: ConversationTabulator,
  ) {}

  async execute(
    input: TabulationInput & { conversationId: string },
  ): Promise<ConversationDisposition> {
    const { conversation, member } = await this.visible.load(input.conversationId);
    return this.unitOfWork.run(async () => {
      const record = await this.tabulator.apply(conversation, member.membershipId, input);
      await this.conversations.save(conversation);
      await this.events.publish(conversation.pullEvents());
      return record;
    });
  }
}

/** Histórico de tabulações de uma conversa (mais recentes primeiro). */
@Injectable()
export class ListConversationDispositionsUseCase {
  constructor(
    @Inject(CONVERSATION_DISPOSITION_REPOSITORY)
    private readonly history: ConversationDispositionRepository,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(conversationId: string): Promise<ConversationDisposition[]> {
    await this.visible.load(conversationId);
    return this.history.listByConversation(conversationId);
  }
}
