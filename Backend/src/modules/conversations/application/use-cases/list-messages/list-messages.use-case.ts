import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage, PageRequest } from '../../../../../shared/application/pagination';
import type { Message } from '../../../domain/message.entity';
import { MESSAGE_REPOSITORY, type MessageRepository } from '../../ports/message.repository';
import { VisibleConversations } from '../../visible-conversations';

/** Mensagens de uma conversa, mais recentes primeiro (o chat carrega para trás). */
@Injectable()
export class ListMessagesUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(conversationId: string, page: PageRequest): Promise<CursorPage<Message>> {
    const { conversation } = await this.visible.load(conversationId);
    return this.messages.listByConversation(conversation.id, page);
  }
}
