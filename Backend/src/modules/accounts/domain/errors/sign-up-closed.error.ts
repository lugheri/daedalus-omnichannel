import { ForbiddenError } from '../../../../shared/domain/domain-error';

/**
 * Cadastro público recusado. Dois motivos, com códigos próprios porque pedem
 * ações diferentes: `SIGNUP_DISABLED` é decisão de configuração (só entra por
 * convite); `SIGNUP_PLATFORM_NOT_READY` é passo de implantação pendente (falta
 * rodar o `designate-root`).
 */
export class SignUpClosedError extends ForbiddenError {
  constructor(readonly code: 'SIGNUP_DISABLED' | 'SIGNUP_PLATFORM_NOT_READY') {
    super(
      code === 'SIGNUP_DISABLED'
        ? 'Public sign-up is disabled; accounts are created by invitation'
        : 'The platform account has not been designated yet',
    );
  }
}
