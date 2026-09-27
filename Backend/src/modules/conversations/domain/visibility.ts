/**
 * Quais conversas um membro enxerga, a partir das permissões de escopo
 * (`conversations:view:own|team|all`, ADR 0003):
 *
 * - `all`: todas as conversas da conta;
 * - `own`: as atribuídas a ele e as SEM responsável (a fila de onde ele puxa).
 *
 * PROVISÓRIO até existirem equipes (passo 6): `:team` vale como `own` — o
 * lado restritivo, para não abrir dados por engano.
 */
export type ConversationScope = { kind: 'all' } | { kind: 'own'; membershipId: string };

export function scopeFor(member: {
  membershipId: string;
  permissions: readonly string[];
}): ConversationScope | null {
  if (member.permissions.includes('conversations:view:all')) return { kind: 'all' };
  if (
    member.permissions.includes('conversations:view:team') ||
    member.permissions.includes('conversations:view:own')
  ) {
    return { kind: 'own', membershipId: member.membershipId };
  }
  return null;
}

export function isVisible(
  conversation: { assigneeId: string | null },
  scope: ConversationScope,
): boolean {
  if (scope.kind === 'all') return true;
  return conversation.assigneeId === null || conversation.assigneeId === scope.membershipId;
}
