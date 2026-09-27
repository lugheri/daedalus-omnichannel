import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenScopeError } from '../domain/errors/forbidden-scope.error';
import type { Conversation } from '../domain/conversation.entity';
import { ConversationNotFoundError } from '../domain/errors/conversation-not-found.error';
import { isVisible, scopeFor, type ConversationScope } from '../domain/visibility';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from './ports/conversation.repository';
import { MEMBER_ACCESS, type CurrentMember, type MemberAccess } from './ports/member-access';

/**
 * Porta de entrada das operações de um membro sobre conversas: resolve o
 * escopo dele e só entrega conversas dentro desse escopo. Conversa fora do
 * escopo responde como inexistente (404), sem revelar que existe.
 */
@Injectable()
export class VisibleConversations {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MEMBER_ACCESS) private readonly access: MemberAccess,
  ) {}

  async scope(): Promise<{ member: CurrentMember; scope: ConversationScope }> {
    const member = await this.access.current();
    const scope = scopeFor(member);
    // O guard já exige uma das permissões de escopo; isto é defesa em profundidade.
    if (!scope) throw new ForbiddenScopeError();
    return { member, scope };
  }

  async load(id: string): Promise<{ conversation: Conversation; member: CurrentMember }> {
    const { member, scope } = await this.scope();
    const conversation = await this.conversations.findById(id);
    if (!conversation || !isVisible(conversation, scope)) throw new ConversationNotFoundError();
    return { conversation, member };
  }
}
