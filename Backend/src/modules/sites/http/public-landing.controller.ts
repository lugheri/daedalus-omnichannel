import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../shared/http/public.decorator';
import { RecordLandingViewUseCase } from '../application/use-cases/landing-pages.use-cases';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aviso de visita das landing pages publicadas (ADR 0014). A página manda um
 * POST sem corpo e sem CORS (`mode: no-cors`): a resposta nem é lida. Sempre
 * 204 — variante desconhecida ou página fora do ar só não contam.
 */
@Public()
@Controller('v1/public/landing')
export class PublicLandingController {
  constructor(private readonly recordView: RecordLandingViewUseCase) {}

  @Post('views/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async view(@Param('variantId') variantId: string): Promise<void> {
    if (UUID.test(variantId)) await this.recordView.execute(variantId);
  }
}
