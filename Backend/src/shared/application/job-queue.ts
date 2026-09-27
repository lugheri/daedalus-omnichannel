/**
 * Trabalho assíncrono, processado pelo `worker`. O use case enfileira sem
 * saber qual tecnologia de fila existe por trás (hoje BullMQ no Redis).
 *
 * Cada tipo de job é declarado uma vez, com o tipo do payload:
 *
 *   export const ProcessInboundWebhookJob =
 *     defineJob<{ provider: string; body: unknown }>('channels', 'process-inbound-webhook');
 *
 * O tenant e o correlation id da operação atual seguem junto com o job
 * automaticamente — o processor os restaura antes de executar.
 */
export interface JobDefinition<TPayload> {
  readonly queue: string;
  readonly name: string;
  /** Só carrega o tipo do payload; não existe em tempo de execução. */
  readonly payloadType?: TPayload;
}

export function defineJob<TPayload>(queue: string, name: string): JobDefinition<TPayload> {
  return { queue, name };
}

export type JobPayload<J> = J extends JobDefinition<infer P> ? P : never;

export interface EnqueueOptions {
  /**
   * Id estável do job: enfileirar de novo com o mesmo id é ignorado enquanto
   * o job existir — é assim que se evita processar o mesmo webhook duas vezes.
   */
  jobId?: string;
  delayMs?: number;
  /** Tentativas antes de desistir (padrão 5, com espera exponencial). */
  attempts?: number;
}

export interface JobQueue {
  add<TPayload>(
    job: JobDefinition<TPayload>,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<void>;
}

export const JOB_QUEUE = Symbol('JobQueue');
