import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { DomainError } from '../../../shared/domain/domain-error';
import { Public } from '../../../shared/http/public.decorator';
import { SubmitFormUseCase } from '../application/use-cases/forms.use-cases';
import type { SubmissionFields } from '../domain/submission';
import { FormKeyGuard, type FormKeyRequest } from './form-key.guard';
import { errorPage, thanksPage } from './public-pages';

/** Nomes de campo aceitos (os do HTML que o CRM gera, em português, e em inglês). */
const FIELDS: Record<keyof SubmissionFields, string[]> = {
  name: ['nome', 'name'],
  phone: ['telefone', 'celular', 'whatsapp', 'phone'],
  email: ['email', 'e-mail'],
  message: ['mensagem', 'message'],
  serviceId: ['servico', 'service'],
  preferredDate: ['data_preferida', 'preferred_date'],
};

/** Campo isca: invisível para pessoas; robô que preenche tudo se entrega. */
export const HONEYPOT_FIELD = 'website';

function pick(body: Record<string, unknown>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const value = body[alias];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return null;
}

/**
 * Envio dos formulários do site: `<form method="post">` direto para cá, sem
 * JavaScript e sem chave de API (a chave pública da URL diz o formulário).
 *
 * - Navegador: responde com redirect (303) para a página de obrigado do site
 *   (ou a nossa); erro vira uma página simples com o motivo e "voltar".
 * - `Accept: application/json`: responde JSON (integrações, páginas com JS).
 * - Limite por IP contra abuso; campo isca descartado em silêncio.
 */
@Public()
@Controller('v1/public/forms')
export class PublicFormsController {
  constructor(private readonly submitForm: SubmitFormUseCase) {}

  @Get('obrigado')
  thanks(@Res() reply: FastifyReply) {
    void reply.type('text/html; charset=utf-8').send(thanksPage());
  }

  @Post(':key')
  @UseGuards(FormKeyGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async submit(@Req() request: FormKeyRequest, @Body() body: unknown, @Res() reply: FastifyReply) {
    const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const wantsJson = (request.headers.accept ?? '').includes('application/json');
    const thanksUrl = '/v1/public/forms/obrigado';

    // Robô: finge que deu certo e não registra nada.
    if (pick(fields, [HONEYPOT_FIELD])) {
      return wantsJson ? reply.send({ ok: true }) : reply.redirect(thanksUrl, 303);
    }

    const raw = Object.fromEntries(
      Object.entries(FIELDS).map(([key, aliases]) => [key, pick(fields, aliases)]),
    ) as Partial<Record<keyof SubmissionFields, string | null>>;

    // De onde veio (`?ref=` na ação do formulário, ou campo `ref`): as landing pages
    // marcam a variante para contar a conversão.
    const query = (request.query ?? {}) as Record<string, unknown>;
    const ref = pick(query, ['ref']) ?? pick(fields, ['ref']);

    try {
      const { successUrl } = await this.submitForm.execute(request.formId!, raw, ref);
      return wantsJson ? reply.send({ ok: true }) : reply.redirect(successUrl ?? thanksUrl, 303);
    } catch (error) {
      // JSON: o filtro global responde { code, message } como no resto da API.
      if (wantsJson || !(error instanceof DomainError)) throw error;
      const back = request.headers.referer ?? null;
      return reply.status(422).type('text/html; charset=utf-8').send(errorPage(error.code, back));
    }
  }
}
