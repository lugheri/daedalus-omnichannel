/**
 * Quem é o membro da requisição e se ele vê todos os negócios. Adapter em
 * infra/ sobre o accounts (permissões).
 *
 * Quem vê o quê (ver `DealVisibility`):
 * - `conversations:view:all` ou `:team` (supervisão): todos os negócios;
 * - `conversations:view:own` (atendimento): os seus, os sem responsável (a
 *   fila de leads) e os de conversas que ele vê.
 */
export interface DealViewer {
  membershipId: string;
  seesAll: boolean;
}

export interface DealAccess {
  current(): Promise<DealViewer>;
}

export const DEAL_ACCESS = Symbol('KanbanDealAccess');
