/**
 * O tenant da operação atual (requisição HTTP, conexão WebSocket ou job).
 * Nunca vem do cliente: é preenchido a partir do token autenticado (ADR 0002).
 * Ler `tenantId` sem tenant resolvido lança `TenantNotResolvedError`.
 */
export interface TenantContext {
  readonly tenantId: string;
}

export const TENANT_CONTEXT = Symbol('TenantContext');

export class TenantNotResolvedError extends Error {
  readonly code = 'TENANT_NOT_RESOLVED';

  constructor() {
    super('No tenant resolved for the current operation');
    this.name = 'TenantNotResolvedError';
  }
}
