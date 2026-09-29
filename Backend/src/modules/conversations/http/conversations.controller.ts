import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { mediaKindOf, servedMimeType } from '../../../shared/domain/media-type';
import { GetMessageMediaUseCase } from '../application/use-cases/get-message-media/get-message-media.use-case';
import { SendAttachmentUseCase } from '../application/use-cases/send-attachment/send-attachment.use-case';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequireAnyPermission, RequirePermissions } from '../../accounts';
import {
  ClaimConversationUseCase,
  TransferConversationUseCase,
} from '../application/use-cases/assign-conversation/assign-conversation.use-cases';
import { GetConversationUseCase } from '../application/use-cases/get-conversation/get-conversation.use-case';
import { ListConversationsUseCase } from '../application/use-cases/list-conversations/list-conversations.use-case';
import { ListMessagesUseCase } from '../application/use-cases/list-messages/list-messages.use-case';
import { SendMessageUseCase } from '../application/use-cases/send-message/send-message.use-case';
import {
  ChangeConversationStatusUseCase,
  MarkConversationReadUseCase,
} from '../application/use-cases/update-conversation/update-conversation.use-cases';
import type { ConversationStatus } from '../domain/conversation.entity';
import {
  ListConversationDispositionsUseCase,
  TabulateConversationUseCase,
} from '../application/use-cases/tabulate-conversation/tabulate-conversation.use-cases';
import {
  ConversationDispositionPresenter,
  ConversationPresenter,
  MessagePresenter,
} from './conversation.presenter';
import {
  changeStatusSchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  tabulateSchema,
  transferSchema,
  type ChangeStatusDto,
  type ListConversationsQuery,
  type ListMessagesQuery,
  type SendMessageDto,
  type TabulateDto,
  type TransferDto,
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
    private readonly claimConversation: ClaimConversationUseCase,
    private readonly transferConversation: TransferConversationUseCase,
    private readonly sendAttachment: SendAttachmentUseCase,
    private readonly getMessageMedia: GetMessageMediaUseCase,
    private readonly tabulateConversation: TabulateConversationUseCase,
    private readonly listDispositions: ListConversationDispositionsUseCase,
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

  /**
   * Anexo (multipart: campo `caption` opcional ANTES do campo `file`). O
   * limite de tamanho é aplicado durante o upload (MEDIA_MAX_MB).
   */
  @Post(':id/attachments')
  @HttpCode(HttpStatus.ACCEPTED)
  async attach(@Param('id', idParam) id: string, @Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException({ code: 'ATTACHMENT_MISSING', message: 'No file sent' });
    }
    let content: Buffer;
    try {
      content = await file.toBuffer();
    } catch (error) {
      if (error instanceof request.server.multipartErrors.RequestFileTooLargeError) {
        throw new PayloadTooLargeException({
          code: 'ATTACHMENT_TOO_LARGE',
          message: 'File exceeds the size limit',
        });
      }
      throw error;
    }
    const caption = file.fields.caption;
    const message = await this.sendAttachment.execute({
      conversationId: id,
      content,
      mimeType: file.mimetype,
      fileName: file.filename || null,
      caption:
        caption && !Array.isArray(caption) && caption.type === 'field'
          ? String(caption.value)
          : null,
    });
    return MessagePresenter.toHttp(message);
  }

  /**
   * Arquivo de uma mensagem. Só imagem/áudio/vídeo conhecidos vão como o
   * próprio tipo; o resto vai como binário para download — nunca como algo
   * que o navegador execute (HTML, SVG).
   */
  @Get(':id/messages/:messageId/media')
  async media(
    @Param('id', idParam) conversationId: string,
    @Param('messageId', idParam) messageId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const file = await this.getMessageMedia.execute({ conversationId, messageId });
    const type = servedMimeType(file.mimeType);
    const inline = mediaKindOf(file.mimeType) !== 'document';
    const name = encodeURIComponent(file.fileName ?? 'arquivo');
    void reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .header('Cache-Control', 'private, max-age=300');
    return new StreamableFile(file.stream, {
      type,
      disposition: `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
      ...(file.size !== null && { length: file.size }),
    });
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
      disposition: body.disposition,
    });
  }

  /** Tabula o atendimento (a qualquer momento; cada uma fica no histórico). */
  @Post(':id/dispositions')
  async tabulate(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(tabulateSchema)) body: TabulateDto,
  ) {
    return ConversationDispositionPresenter.toHttp(
      await this.tabulateConversation.execute({ conversationId: id, ...body }),
    );
  }

  /** Histórico de tabulações da conversa (mais recentes primeiro). */
  @Get(':id/dispositions')
  async dispositions(@Param('id', idParam) id: string) {
    return (await this.listDispositions.execute(id)).map(ConversationDispositionPresenter.toHttp);
  }

  /** Pega para si uma conversa sem responsável (qualquer escopo). */
  @Post(':id/claim')
  @HttpCode(HttpStatus.NO_CONTENT)
  async claim(@Param('id', idParam) id: string) {
    await this.claimConversation.execute(id);
  }

  /** Transfere para uma equipe e/ou pessoa. */
  @RequirePermissions('conversations:assign')
  @Post(':id/transfer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async transfer(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(transferSchema)) body: TransferDto,
  ) {
    await this.transferConversation.execute({ conversationId: id, ...body });
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(@Param('id', idParam) id: string) {
    await this.markRead.execute(id);
  }
}
