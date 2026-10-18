import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { ChannelsModule } from '../channels';
import { ContactsModule } from '../contacts';
import { ConversationsModule } from '../conversations';
import { VISITOR_TOKENS } from './application/ports/visitor-tokens';
import { WEB_CHAT_BACKEND } from './application/ports/web-chat-backend';
import {
  AuthenticateVisitorUseCase,
  GetWidgetConfigUseCase,
  SendVisitorMessageUseCase,
  StartVisitorSessionUseCase,
  VisitorHistoryUseCase,
} from './application/web-chat.use-cases';
import { PublicChatController } from './http/public-chat.controller';
import { VisitorGuard } from './http/visitor.guard';
import { WebChatGateway } from './http/web-chat.gateway';
import { FacadeWebChatBackend } from './infra/facade-web-chat-backend';
import { HmacVisitorTokens } from './infra/hmac-visitor-tokens';
import { VISITOR_TOKEN_SETTINGS, type VisitorTokenSettings } from './infra/visitor-token-settings';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Lado público do chat do site (ADR 0012): o widget que roda no site da
 * conta, a identificação do visitante, as mensagens dele e o WebSocket dos
 * visitantes. A gestão do canal fica no módulo channels; as conversas, no
 * conversations. Só na API (o worker não serve o widget).
 */
@Module({
  imports: [ChannelsModule, ContactsModule, ConversationsModule],
  controllers: [PublicChatController],
  providers: [
    GetWidgetConfigUseCase,
    StartVisitorSessionUseCase,
    AuthenticateVisitorUseCase,
    VisitorHistoryUseCase,
    SendVisitorMessageUseCase,
    VisitorGuard,
    WebChatGateway,
    { provide: WEB_CHAT_BACKEND, useClass: FacadeWebChatBackend },
    { provide: VISITOR_TOKENS, useClass: HmacVisitorTokens },
    {
      provide: VISITOR_TOKEN_SETTINGS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): VisitorTokenSettings => ({
        secret: config.jwtSecret,
        tokenTtlMs: THIRTY_DAYS_MS,
      }),
    },
  ],
})
export class WebChatModule {}
