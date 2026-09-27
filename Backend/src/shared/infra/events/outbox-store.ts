export interface OutboxRecord {
  id: string;
  eventName: string;
  tenantId: string | null;
  correlationId: string | null;
  payload: Record<string, unknown>;
}

/**
 * Leitura do outbox pelo relay. `claim` trava um lote de eventos pendentes
 * (outras réplicas do worker pulam os travados), entrega-os ao callback e
 * só os marca como publicados se o callback terminar sem erro.
 */
export interface OutboxStore {
  claim(limit: number, deliver: (records: OutboxRecord[]) => Promise<void>): Promise<number>;
}

export const OUTBOX_STORE = Symbol('OutboxStore');
