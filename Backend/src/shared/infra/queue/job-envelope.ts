/**
 * Formato de todo job na fila: o payload do caso de uso e os metadados da
 * operação que o originou. Mudar este formato quebra jobs já enfileirados —
 * trate como contrato versionado.
 */
export interface JobEnvelope<TPayload = unknown> {
  v: 1;
  payload: TPayload;
  meta: {
    tenantId?: string;
    correlationId?: string;
  };
}
