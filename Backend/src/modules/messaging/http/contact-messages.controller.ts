import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  GetAvailableChannelsUseCase,
  ListContactMessagesUseCase,
  ListContactOptOutsUseCase,
  RemoveContactOptOutUseCase,
  SendToContactUseCase,
} from '../application/use-cases/contact-messages.use-cases';
import type { MessagingChannel } from '../domain/messaging-provider.entity';
import {
  channelParamSchema,
  sendToContactSchema,
  type SendToContactDto,
} from './dto/messaging.dto';
import { OutboundMessagePresenter } from './outbound.presenter';

const idParam = new ZodValidationPipe(z.uuid());

/** E-mail/SMS para um contato, pela ficha dele. */
@Controller('v1/messaging')
export class ContactMessagesController {
  constructor(
    private readonly availableChannels: GetAvailableChannelsUseCase,
    private readonly sendToContact: SendToContactUseCase,
    private readonly listMessages: ListContactMessagesUseCase,
    private readonly listOptOuts: ListContactOptOutsUseCase,
    private readonly removeOptOut: RemoveContactOptOutUseCase,
  ) {}

  /** `{ email, sms }`: quais canais a conta configurou (sem detalhes). */
  @RequirePermissions('messaging:send')
  @Get('channels')
  channels() {
    return this.availableChannels.execute();
  }

  /** 202: vai para a fila; o status muda com a entrega. */
  @RequirePermissions('messaging:send', 'contacts:view')
  @Post('contacts/:contactId/messages')
  @HttpCode(HttpStatus.ACCEPTED)
  async send(
    @Param('contactId', idParam) contactId: string,
    @Body(new ZodValidationPipe(sendToContactSchema)) body: SendToContactDto,
  ) {
    return OutboundMessagePresenter.toHttp(
      await this.sendToContact.execute({ contactId, ...body }),
    );
  }

  @RequirePermissions('contacts:view')
  @Get('contacts/:contactId/messages')
  async messages(@Param('contactId', idParam) contactId: string) {
    return (await this.listMessages.execute(contactId)).map(OutboundMessagePresenter.toHttp);
  }

  @RequirePermissions('contacts:view')
  @Get('contacts/:contactId/opt-outs')
  async optOuts(@Param('contactId', idParam) contactId: string) {
    return (await this.listOptOuts.execute(contactId)).map(OutboundMessagePresenter.optOut);
  }

  /** Reativar (só a pedido do próprio contato). */
  @RequirePermissions('messaging:manage')
  @Delete('contacts/:contactId/opt-outs/:channel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(
    @Param('contactId', idParam) contactId: string,
    @Param('channel', new ZodValidationPipe(channelParamSchema)) channel: MessagingChannel,
  ) {
    await this.removeOptOut.execute(contactId, channel);
  }
}
