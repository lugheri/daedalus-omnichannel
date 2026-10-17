import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { AppConfigModule } from './config/app-config.module';
import { AccountsModule, DesignateRootAccountUseCase } from './modules/accounts';
import { IdentityModule } from './modules/identity';
import { PrismaModule } from './shared/infra/prisma/prisma.module';
import { SharedInfraModule } from './shared/infra/shared-infra.module';

@Module({
  imports: [AppConfigModule, PrismaModule, SharedInfraModule, IdentityModule, AccountsModule],
})
class DesignateRootModule {}

/**
 * Define a conta da plataforma (raiz da árvore de contas — ADR 0009), uma vez:
 *
 *   node dist/designate-root.js <slug-da-conta>
 *
 * Toda conta que ainda não tem mãe passa a ficar debaixo dela, e os
 * cadastros públicos seguintes nascem como filhas dela.
 */
async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Uso: node dist/designate-root.js <slug-da-conta>');
    process.exit(2);
  }
  const app = await NestFactory.createApplicationContext(DesignateRootModule, {
    logger: ['error', 'warn'],
  });
  try {
    const useCase = app.get(DesignateRootAccountUseCase);
    // Os repositórios usam a transação do contexto (CLS): roda dentro de um.
    const { root, adopted } = await app.get(ClsService).run(() => useCase.execute(slug));
    console.log(`Conta da plataforma: ${root.name} (${root.slug.value}).`);
    console.log(`Contas sem mãe que passaram para debaixo dela: ${adopted}.`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const code = (error as { code?: string }).code;
  console.error(code ? `Não foi possível: ${code}` : error);
  process.exit(1);
});
