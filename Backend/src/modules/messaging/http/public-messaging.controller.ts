import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../../../shared/http/public.decorator';
import {
  AcceptProviderWebhookUseCase,
  WebhookRejected,
} from '../application/use-cases/provider-webhooks.use-cases';
import { UnsubscribeUseCase } from '../application/use-cases/unsubscribe.use-cases';
import { unsubscribePage } from './unsubscribe.page';

/** Volume alto e de poucos IPs (dos provedores): limite maior que o padrão. */
const WEBHOOK_THROTTLE = { default: { limit: 3000, ttl: 60_000 } };

type Form = Record<string, string>;

/**
 * Rotas públicas do messaging: webhooks dos provedores (a assinatura prova a
 * origem) e a página de descadastro (o token assinado prova o endereço).
 */
@Public()
@Controller('v1/public')
export class PublicMessagingController {
  constructor(
    private readonly webhooks: AcceptProviderWebhookUseCase,
    private readonly unsubscribe: UnsubscribeUseCase,
  ) {}

  @Throttle(WEBHOOK_THROTTLE)
  @Post('webhooks/twilio/:providerId/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async twilioStatus(@Param('providerId') providerId: string, @Req() request: FastifyRequest) {
    await this.accept(() =>
      this.webhooks.twilioStatus({
        providerId,
        requestUrl: request.url,
        query: request.query as Form,
        params: formOf(request),
        signature: header(request, 'x-twilio-signature'),
      }),
    );
  }

  /** Responde TwiML vazio: não mandamos resposta automática ao SMS. */
  @Throttle(WEBHOOK_THROTTLE)
  @Post('webhooks/twilio/:providerId/inbound')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  async twilioInbound(@Param('providerId') providerId: string, @Req() request: FastifyRequest) {
    await this.accept(() =>
      this.webhooks.twilioInbound({
        providerId,
        requestUrl: request.url,
        params: formOf(request),
        signature: header(request, 'x-twilio-signature'),
      }),
    );
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  @Throttle(WEBHOOK_THROTTLE)
  @Post('webhooks/sendgrid/:providerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendgrid(
    @Param('providerId') providerId: string,
    @Req() request: RawBodyRequest<FastifyRequest>,
  ) {
    await this.accept(() =>
      this.webhooks.sendgridEvents({
        providerId,
        rawBody: request.rawBody,
        timestamp: header(request, 'x-twilio-email-event-webhook-timestamp'),
        signature: header(request, 'x-twilio-email-event-webhook-signature'),
      }),
    );
  }

  /** Página de confirmação (GET não descadastra: antivírus de e-mail abrem links). */
  @Get('unsubscribe/:token')
  async showUnsubscribe(@Param('token') token: string, @Res() reply: FastifyReply) {
    return send(reply, unsubscribePage(await this.unsubscribe.inspect(token), token));
  }

  /** Botão da página ou "cancelar inscrição" de um clique (RFC 8058). */
  @Post('unsubscribe/:token')
  async confirmUnsubscribe(@Param('token') token: string, @Res() reply: FastifyReply) {
    return send(reply, unsubscribePage(await this.unsubscribe.confirm(token), token));
  }

  private async accept(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof WebhookRejected) {
        throw new UnauthorizedException({ code: 'WEBHOOK_REJECTED', message: 'Invalid signature' });
      }
      throw error;
    }
  }
}

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Corpo form-urlencoded da Twilio (o Nest/Fastify já decodifica). */
function formOf(request: FastifyRequest): Form {
  const body = request.body;
  if (!body || typeof body !== 'object') return {};
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
  );
}

function send(reply: FastifyReply, page: { status: number; html: string }) {
  return reply
    .status(page.status)
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Cache-Control', 'no-store')
    .header('X-Robots-Tag', 'noindex')
    .header(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    )
    .send(page.html);
}
