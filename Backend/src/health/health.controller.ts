import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../shared/http/public.decorator';
import { HealthService } from './health.service';

/** Sondas do orquestrador: sem autenticação e sem rate limit. */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const { ready, checks } = await this.health.readiness();
    if (!ready) throw new ServiceUnavailableException({ status: 'error', checks });
    return { status: 'ok', checks };
  }
}
