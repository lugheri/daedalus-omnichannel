import { DomainError } from '../../../../shared/domain/domain-error';

/**
 * O provedor recusou o envio (credencial inválida, remetente não
 * verificado, destino inválido). `reason` é a mensagem do provedor.
 */
export class ProviderRejectedError extends DomainError {
  readonly code = 'MESSAGING_PROVIDER_REJECTED';

  constructor(readonly reason: string) {
    super(`Provider rejected the message: ${reason}`);
  }
}
