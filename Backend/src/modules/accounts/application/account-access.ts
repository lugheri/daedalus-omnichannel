import type { SystemRoleKey } from '../domain/default-roles';
import { CannotGrantPermissionError } from '../domain/errors/cannot-grant-permission.error';
import type { Permission } from '../domain/permissions';

/**
 * O que o ator pode fazer no tenant em que está logado, resolvido a cada
 * requisição (com cache curto). Objeto simples: vai para o cache no Redis.
 */
export interface AccountAccess {
  userId: string;
  tenantId: string;
  membershipId: string;
  role: { id: string; key: SystemRoleKey | null; name: string };
  permissions: Permission[];
}

/** As permissões exigidas que o acesso NÃO tem (vazio = tem todas). */
export function missingPermissions(access: AccountAccess, required: readonly Permission[]) {
  return required.filter((permission) => !access.permissions.includes(permission));
}

/**
 * Regra anti-escalada: o ator só concede — e só administra quem tem — um
 * conjunto de permissões contido nas suas próprias.
 */
export function assertCanGrant(access: AccountAccess, permissions: readonly Permission[]) {
  const missing = missingPermissions(access, permissions);
  if (missing.length > 0) throw new CannotGrantPermissionError(missing);
}

export function hasAnyPermission(access: AccountAccess, candidates: readonly Permission[]) {
  return candidates.some((permission) => access.permissions.includes(permission));
}
