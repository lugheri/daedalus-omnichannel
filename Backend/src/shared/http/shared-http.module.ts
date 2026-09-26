import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from './domain-error.filter';

/**
 * Peças HTTP globais. Registrar via APP_FILTER (e não `app.useGlobalFilters`
 * no main.ts) permite que o filtro receba dependências por injeção.
 */
@Module({
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class SharedHttpModule {}
