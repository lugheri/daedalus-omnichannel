import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfig } from '../../../config/app-config';
import { PrismaClient } from './generated/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
