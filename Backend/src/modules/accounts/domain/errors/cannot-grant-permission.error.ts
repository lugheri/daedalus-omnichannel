import { ForbiddenError } from '../../../../shared/domain/domain-error';
import type { Permission } from '../permissions';

/**
 * Regra anti-escalada: ninguém concede (criando cargo, editando cargo,
 * convidando ou trocando o cargo de alguém) uma permissão que não tem.
 * É o que impede um Admin de tornar alguém Owner.
 */
export class CannotGrantPermissionError extends ForbiddenError {
  readonly code = 'AUTH_CANNOT_GRANT';

  constructor(readonly permissions: readonly Permission[]) {
    super(`You cannot grant permissions you do not have: ${permissions.join(', ')}`);
  }
}
