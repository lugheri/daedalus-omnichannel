import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { WorkerModule } from '../../src/worker.module';

/**
 * Os processos montam? Compila o container de injeção COMPLETO da API e do
 * worker. Pega o que os testes unitários não veem: provider sem registro,
 * fila não visível no módulo, tipo de construtor que o Nest não resolve
 * (`import type` / type alias no lugar da classe).
 */
describe('Process modules (DI)', () => {
  it('the API module compiles', async () => {
    const app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.close();
  });

  it('the worker module compiles', async () => {
    const worker = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    await worker.close();
  });
});
