import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { Public } from '../../../shared/http/public.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import {
  GetBookingPageUseCase,
  PublicBookUseCase,
  PublicSlotsUseCase,
} from '../application/use-cases/booking.use-cases';
import { publicBookingSchema, publicSlotsQuery } from './dto/agenda.dto';

/** O script do widget de agendamento (copiado para o dist pelo nest-cli). */
const WIDGET_JS = readFileSync(join(__dirname, 'assets', 'booking-widget.js'), 'utf8');

const keyParam = new ZodValidationPipe(z.string().min(8).max(100));

/**
 * Agendamento pelo site (ADR 0013): o script do widget, os serviços e
 * profissionais, os horários livres e a marcação. Chamado de QUALQUER site
 * (CORS aberto só nestas rotas, sem cookie — ver main.ts); a conta vem da
 * chave do widget.
 */
@Public()
@Controller('v1/public/booking')
export class PublicBookingController {
  constructor(
    private readonly page: GetBookingPageUseCase,
    private readonly slots: PublicSlotsUseCase,
    private readonly book: PublicBookUseCase,
  ) {}

  /** `<script src=".../v1/public/booking/widget.js" data-key="CHAVE" async>` */
  @Get('widget.js')
  @SkipThrottle()
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  widget() {
    return WIDGET_JS;
  }

  @Get(':key')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async info(@Param('key', keyParam) key: string) {
    const page = await this.page.execute(key);
    return {
      today: page.today,
      maxDaysAhead: page.settings.maxDaysAhead,
      timezone: page.settings.timezone,
      services: page.services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
      })),
      professionals: page.professionals.map((p) => ({
        id: p.id,
        name: p.name,
        serviceIds: p.offeringIds,
      })),
    };
  }

  @Get(':key/slots')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async free(
    @Param('key', keyParam) key: string,
    @Query(new ZodValidationPipe(publicSlotsQuery)) query: z.infer<typeof publicSlotsQuery>,
  ) {
    return (await this.slots.execute(key, query)).map((s) => s.startsAt.toISOString());
  }

  @Post(':key/appointments')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @Param('key', keyParam) key: string,
    @Body(new ZodValidationPipe(publicBookingSchema)) body: z.infer<typeof publicBookingSchema>,
  ) {
    const { website, ...input } = body;
    // Robô (preencheu o campo isca): finge que deu certo e não marca nada.
    if (website) return { ok: true };
    const { appointment, professionalName } = await this.book.execute(key, input);
    return {
      ok: true,
      startsAt: appointment.startsAt.toISOString(),
      serviceName: appointment.serviceName,
      professionalName,
    };
  }
}
