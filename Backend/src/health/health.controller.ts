import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../shared/infra/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', checks: { database: 'up' } };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', checks: { database: 'down' } });
    }
  }
}
