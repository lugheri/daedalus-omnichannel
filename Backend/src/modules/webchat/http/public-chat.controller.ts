import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { Public } from '../../../shared/http/public.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import {
  GetWidgetConfigUseCase,
  SendVisitorMessageUseCase,
  StartVisitorSessionUseCase,
  VisitorHistoryUseCase,
} from '../application/web-chat.use-cases';
import { VisitorGuard, type VisitorRequest } from './visitor.guard';

/** O script do widget (arquivo JS de verdade, copiado para o dist pelo nest-cli). */
const WIDGET_JS = readFileSync(join(__dirname, 'assets', 'chat-widget.js'), 'utf8');

const keyParam = new ZodValidationPipe(z.string().min(8).max(100));
const sessionSchema = z.object({
  name: z.string().max(200),
  phone: z.string().max(40).nullable().default(null),
  email: z.string().max(320).nullable().default(null),
});
const messageSchema = z.object({
  /** Gerado pelo widget (uuid): reenviar não duplica. */
  id: z.string().max(64),
  text: z.string().max(4_000),
});

function visitorOf(request: VisitorRequest) {
  // O VisitorGuard sempre preenche (ou recusa a requisição).
  return request.visitor!;
}

/**
 * Lado público do chat do site (ADR 0012): o script do widget, a
 * configuração, a identificação do visitante e as mensagens. Chamado de
 * QUALQUER site (o CORS destas rotas aceita qualquer origem, sem cookie —
 * ver main.ts). A conta vem da chave do widget ou do token do visitante.
 */
@Public()
@Controller('v1/public/chat')
export class PublicChatController {
  constructor(
    private readonly getConfig: GetWidgetConfigUseCase,
    private readonly startSession: StartVisitorSessionUseCase,
    private readonly history: VisitorHistoryUseCase,
    private readonly sendMessage: SendVisitorMessageUseCase,
  ) {}

  /** `<script src=".../v1/public/chat/widget.js" data-key="CHAVE" async>` */
  @Get('widget.js')
  @SkipThrottle()
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  widget() {
    return WIDGET_JS;
  }

  /** Mensagens da sessão (o widget busca ao abrir e a cada aviso do WebSocket). */
  @Get('messages')
  @UseGuards(VisitorGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async messages(@Req() request: VisitorRequest) {
    return (await this.history.execute(visitorOf(request))).map((m) => ({
      ...m,
      sentAt: m.sentAt.toISOString(),
    }));
  }

  @Post('messages')
  @UseGuards(VisitorGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async send(
    @Req() request: VisitorRequest,
    @Body(new ZodValidationPipe(messageSchema)) body: z.infer<typeof messageSchema>,
  ) {
    await this.sendMessage.execute(visitorOf(request), body);
  }

  /** Título, saudação, cor e se está ligado. */
  @Get(':key')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async config(@Param('key', keyParam) key: string) {
    const chat = await this.getConfig.execute(key);
    return { title: chat.title, greeting: chat.greeting, color: chat.color, active: chat.active };
  }

  /** O visitante se identifica (nome + telefone e/ou e-mail) e recebe o token da sessão. */
  @Post(':key/sessions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async session(
    @Param('key', keyParam) key: string,
    @Body(new ZodValidationPipe(sessionSchema)) body: z.infer<typeof sessionSchema>,
  ) {
    const { token, expiresAt, name } = await this.startSession.execute(key, body);
    return { token, expiresAt: expiresAt.toISOString(), name };
  }
}
