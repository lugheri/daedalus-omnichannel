/**
 * Quais conversas um membro enxerga, a partir das permissões de escopo
 * (`conversations:view:own|team|all`, ADR 0003) e das equipes dele:
 *
 * - `all`: todas as conversas da conta;
 * - `team` (supervisão): todas as conversas das suas equipes, as atribuídas a
 *   ele e a fila geral (sem equipe e sem responsável);
 * - `own` (atendimento): as atribuídas a ele e a FILA de onde ele puxa —
 *   conversas sem responsável das suas equipes ou sem equipe.
 *
 * Conversa sem equipe = canal sem equipe: fica na fila geral, visível a todos.
 */
export type ConversationScope =
  { kind: 'all' } | { kind: 'team' | 'own'; membershipId: string; teamIds: readonly string[] };

export interface ScopeMember {
  membershipId: string;
  permissions: readonly string[];
  teamIds: readonly string[];
}

export function scopeFor(member: ScopeMember): ConversationScope | null {
  const { membershipId, teamIds, permissions } = member;
  if (permissions.includes('conversations:view:all')) return { kind: 'all' };
  if (permissions.includes('conversations:view:team')) {
    return { kind: 'team', membershipId, teamIds };
  }
  if (permissions.includes('conversations:view:own')) {
    return { kind: 'own', membershipId, teamIds };
  }
  return null;
}

export function isVisible(
  conversation: { assigneeId: string | null; teamId: string | null },
  scope: ConversationScope,
): boolean {
  if (scope.kind === 'all') return true;

  const { assigneeId, teamId } = conversation;
  if (assigneeId === scope.membershipId) return true;
  const inMyTeam = teamId !== null && scope.teamIds.includes(teamId);

  if (scope.kind === 'team') return inMyTeam || (teamId === null && assigneeId === null);
  return assigneeId === null && (teamId === null || inMyTeam);
}
