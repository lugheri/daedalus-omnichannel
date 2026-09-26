/**
 * Executa um trabalho numa transação: tudo que os repositórios gravarem
 * dentro de `run` é confirmado junto, ou desfeito junto se algo lançar erro.
 * Vale também entre módulos (ex.: cadastro de conta grava em identity e
 * accounts), porque todos os repositórios participam da mesma transação.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
