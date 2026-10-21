import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { AppConfigModule } from './config/app-config.module';
import { IdentityModule, ResetPasswordUseCase } from './modules/identity';
import { PrismaModule } from './shared/infra/prisma/prisma.module';
import { SharedInfraModule } from './shared/infra/shared-infra.module';

@Module({
  imports: [AppConfigModule, PrismaModule, SharedInfraModule, IdentityModule],
})
class ResetPasswordModule {}

/**
 * Redefinição MANUAL de senha (não há recuperação por e-mail ainda):
 *
 *   node dist/reset-password.js <email>
 *
 * Gera uma senha temporária forte, grava o hash (Argon2id, como o cadastro),
 * derruba todas as sessões da pessoa e imprime a senha UMA vez, no terminal de
 * quem roda. Ela não vai para log nenhum: repasse por um canal seguro e peça
 * para a pessoa guardar (ainda não há troca da própria senha no painel).
 * Passo a passo e cuidados em docs/deploy.md.
 */
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: node dist/reset-password.js <email>');
    process.exit(2);
  }
  const app = await NestFactory.createApplicationContext(ResetPasswordModule, {
    logger: ['error', 'warn'],
  });
  try {
    const useCase = app.get(ResetPasswordUseCase);
    // Os repositórios usam a transação do contexto (CLS): roda dentro de um.
    const result = await app.get(ClsService).run(() => useCase.execute(email));
    console.log(`Senha redefinida para ${result.email}.`);
    console.log(`Sessões encerradas: ${result.revokedSessions}.`);
    console.log('');
    console.log(`Senha temporária (aparece só agora): ${result.temporaryPassword}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const code = (error as { code?: string }).code;
  console.error(code ? `Não foi possível: ${code}` : error);
  process.exit(1);
});
