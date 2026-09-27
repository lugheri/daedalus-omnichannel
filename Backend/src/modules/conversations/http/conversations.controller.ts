import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequireAnyPermission } from '../../accounts';
import { GetConversationUseCase } from '../application/use-cases/get-conversation/get-conversation.use-case';
import { ListConversationsUseCase } from '../application/use-cases/list-conversations/list-conversations.use-case';
import { ListMessagesUseCase } from '../application/use-cases/list-messages/list-messages.use-case';
import { SendMessageUseCase } from '../application/use-cases/send-message/send-message.use-case';
import {
  ChangeConversationStatusUseCase,
  MarkConversationReadUseCase,
} from '../application/use-cases/update-conversation/update-conversation.use-cases';
import type { ConversationStatus } from '../domain/conversation.entity';
import { ConversationPresenter, MessagePresenter } from './conversation.presenter';
import {
  changeStatusSchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  type ChangeStatusDto,
  type ListConversationsQuery,
  type ListMessagesQuery,
  type SendMessageDto,
} from './dto/conversation.dto';

const idParam = new ZodValidationPipe(z.uuid());

/**
 * Qualquer permissão de escopo dá acesso às rotas; QUAIS conversas o membro
 * enxerga (e pode responder) é decidido nos use cases (`VisibleConversations`).
 */
@RequireAnyPermission('conversations:view:own', 'conversations:view:team', 'conversations:view:all')
@Controller('v1/conversations')
export class ConversationsController {
  constructor(
    private readonly listConversations: ListConversationsUseCase,
    private readonly getConversation: GetConversationUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly changeStatus: ChangeConversationStatusUseCase,
    private readonly markRead: MarkConversationReadUseCase,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listConversationsQuerySchema)) query: ListConversationsQuery,
  ) {
    const page = await this.listConversations.execute({
      ...query,
      status: query.status as ConversationStatus | undefined,
    });
    return { items: page.items.map(ConversationPresenter.toHttp), nextCursor: page.nextCursor };
  }

  @Get(':id')
  async get(@Param('id', idParam) id: string) {
    return ConversationPresenter.toHttp(await this.getConversation.execute(id));
  }

  @Get(':id/messages')
  async messages(
    @Param('id', idParam) id: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ) {
    const page = await this.listMessages.execute(id, query);
    return { items: page.items.map(MessagePresenter.toHttp), nextCursor: page.nextCursor };
  }

  /** 202: gravada como pendente; o envio acontece na fila do canal. */
  @Post(':id/messages')
  @HttpCode(HttpStatus.ACCEPTED)
  async send(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageDto,
  ) {
    return MessagePresenter.toHttp(
      await this.sendMessage.execute({ conversationId: id, text: body.text }),
    );
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async status(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(changeStatusSchema)) body: ChangeStatusDto,
  ) {
    await this.changeStatus.execute({
      conversationId: id,
      status: body.status as ConversationStatus,
    });
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(@Param('id', idParam) id: string) {
    await this.markRead.execute(id);
  }
}
