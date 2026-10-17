/**
 * API pública do módulo accounts. Outros módulos só podem importar daqui.
 */
export {
  AccountsFacade,
  type AccountSummary,
  type MemberAccess,
} from './application/accounts.facade';
export { DesignateRootAccountUseCase } from './application/use-cases/child-accounts/child-accounts.use-cases';
export { AccountsModule } from './accounts.module';
export type { SystemRoleKey } from './domain/default-roles';
export { TenantCreatedEvent } from './domain/events/tenant-created.event';
export { PERMISSIONS, type Permission } from './domain/permissions';
export { ApiKeyAuth, ApiKeyGuard } from './http/api-key.guard';
export { RequireAnyPermission, RequirePermissions } from './http/require-permissions.decorator';
