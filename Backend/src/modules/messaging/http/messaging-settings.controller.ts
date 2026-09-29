import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MESSAGING_URLS, type MessagingUrls } from '../application/ports/messaging-urls';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  ListMessagingProvidersUseCase,
  RemoveMessagingProviderUseCase,
  SaveMessagingProviderUseCase,
  SendTestMessageUseCase,
} from '../application/use-cases/messaging-settings.use-cases';
import type { MessagingChannel } from '../domain/messaging-provider.entity';
import {
  channelParamSchema,
  saveEmailProviderSchema,
  saveSmsProviderSchema,
  sendTestSchema,
  type SaveEmailProviderDto,
  type SaveSmsProviderDto,
  type SendTestDto,
} from './dto/messaging.dto';
import { MessagingProviderPresenter } from './messaging.presenter';

const channelParam = new ZodValidationPipe(channelParamSchema);

/** Provedores de e-mail (SendGrid) e SMS (Twilio) da conta. */
@RequirePermissions('messaging:manage')
@Controller('v1/messaging/providers')
export class MessagingSettingsController {
  constructor(
    private readonly listProviders: ListMessagingProvidersUseCase,
    private readonly saveProvider: SaveMessagingProviderUseCase,
    private readonly removeProvider: RemoveMessagingProviderUseCase,
    private readonly sendTest: SendTestMessageUseCase,
    @Inject(MESSAGING_URLS) private readonly urls: MessagingUrls,
  ) {}

  /** `{ email, sms }` — null no canal ainda não configurado. */
  @Get()
  async list() {
    const providers = await this.listProviders.execute();
    const of = (channel: MessagingChannel) => {
      const provider = providers.find((p) => p.channel === channel);
      return provider ? MessagingProviderPresenter.toHttp(provider, this.urls) : null;
    };
    return { email: of('email'), sms: of('sms') };
  }

  @Put('email')
  async saveEmail(
    @Body(new ZodValidationPipe(saveEmailProviderSchema)) body: SaveEmailProviderDto,
  ) {
    const provider = await this.saveProvider.execute({
      settings: {
        provider: 'sendgrid',
        fromEmail: body.fromEmail,
        fromName: body.fromName,
        replyTo: body.replyTo ?? null,
        eventWebhookKey: body.eventWebhookKey ?? null,
      },
      secret: body.apiKey,
    });
    return MessagingProviderPresenter.toHttp(provider, this.urls);
  }

  @Put('sms')
  async saveSms(@Body(new ZodValidationPipe(saveSmsProviderSchema)) body: SaveSmsProviderDto) {
    const provider = await this.saveProvider.execute({
      settings: {
        provider: 'twilio',
        accountSid: body.accountSid,
        from: body.from ?? null,
        messagingServiceSid: body.messagingServiceSid ?? null,
      },
      secret: body.authToken,
    });
    return MessagingProviderPresenter.toHttp(provider, this.urls);
  }

  @Delete(':channel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('channel', channelParam) channel: MessagingChannel) {
    await this.removeProvider.execute(channel);
  }

  /** Envia de verdade (usa créditos do cliente): limitado. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':channel/test')
  async test(
    @Param('channel', channelParam) channel: MessagingChannel,
    @Body(new ZodValidationPipe(sendTestSchema)) body: SendTestDto,
  ) {
    return MessagingProviderPresenter.toHttp(
      await this.sendTest.execute({ channel, to: body.to }),
      this.urls,
    );
  }
}
