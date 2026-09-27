import { ForbiddenError } from '../../../../shared/domain/domain-error';
import type { Permission } from '../permissions';

/** Autenticado e com vínculo ativo, mas o cargo não dá a permissão exigida. */
export class MissingPermissionError extends ForbiddenError {
  readonly code = 'AUTH_MISSING_PERMISSION';

  constructor(message: string) {
    super(message);
  }

  /** Faltam estas permissões (todas eram exigidas). */
  static missing(permissions: readonly Permission[]) {
    return new MissingPermissionError(`Missing permission: ${permissions.join(', ')}`);
  }

  /** Nenhuma destas permissões (bastava uma). */
  static noneOf(permissions: readonly Permission[]) {
    return new MissingPermissionError(`Requires one of: ${permissions.join(', ')}`);
  }
}
