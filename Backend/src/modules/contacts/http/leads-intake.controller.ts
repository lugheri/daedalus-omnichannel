import { Body, Controller, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { ApiKeyAuth } from '../../accounts';
import { CaptureLeadUseCase } from '../application/use-cases/capture-lead/capture-lead.use-case';

/**
 * Nomes de campo aceitos (em português e em inglês), para o cliente poder
 * apontar um formulário/plugin de webhook sem programar nada.
 */
const FIELD_ALIASES = {
  name: ['nome', 'name', 'nome_completo', 'full_name', 'fullname'],
  phone: ['telefone', 'celular', 'whatsapp', 'phone', 'fone', 'tel', 'mobile'],
  email: ['email', 'e-mail', 'e_mail', 'mail'],
  campaign: ['campanha', 'campaign', 'utm_campaign', 'origem', 'source'],
} as const;

type LeadField = keyof typeof FIELD_ALIASES;

/** Primeiro campo presente (sem diferenciar maiúsculas), como texto de até 320 caracteres. */
function pick(body: Record<string, unknown>, field: LeadField): string | null {
  const entries = Object.entries(body).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const alias of FIELD_ALIASES[field]) {
    const value = entries.find(([key]) => key === alias)?.[1];
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim().slice(0, 320);
      if (text) return text;
    }
  }
  return null;
}

/**
 * Entrada de leads por integração (ex.: formulário do site), autenticada pela
 * chave de API da conta — SERVIDOR A SERVIDOR: a chave nunca deve ir para o
 * código de uma página.
 *
 * Aceita JSON ou `application/x-www-form-urlencoded`. Resposta: 201 (novo)
 * ou 200 (já existia; nada é duplicado), com o id do contato.
 */
@ApiKeyAuth()
@Controller('v1/public/leads')
export class LeadsIntakeController {
  constructor(private readonly captureLead: CaptureLeadUseCase) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async capture(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const { contact, created } = await this.captureLead.execute({
      name: pick(fields, 'name'),
      phone: pick(fields, 'phone'),
      email: pick(fields, 'email'),
      campaign: pick(fields, 'campaign'),
    });
    void reply.status(created ? 201 : 200);
    return { contactId: contact.id, created };
  }
}
