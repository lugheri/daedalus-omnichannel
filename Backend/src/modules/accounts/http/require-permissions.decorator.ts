import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../domain/permissions';

export const REQUIRED_PERMISSIONS = 'accounts:required-permissions';
export const REQUIRED_ANY_PERMISSION = 'accounts:required-any-permission';

/**
 * Exige TODAS as permissões listadas. Pode ser usado na classe e no método
 * (as listas se somam). Uso: `@RequirePermissions('contacts:edit')`.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/**
 * Exige AO MENOS UMA das permissões — para as variantes de escopo:
 * `@RequireAnyPermission('conversations:view:own', 'conversations:view:team',
 * 'conversations:view:all')`. O use case então aplica o escopo que o ator tem.
 */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_ANY_PERMISSION, permissions);
