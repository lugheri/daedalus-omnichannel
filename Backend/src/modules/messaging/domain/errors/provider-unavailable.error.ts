import { DomainError } from '../../../../shared/domain/domain-error';

/** Provedor fora do ar, lento demais ou inalcançável (vale tentar de novo). */
export class ProviderUnavailableError extends DomainError {
  readonly code = 'MESSAGING_PROVIDER_UNAVAILABLE';

  constructor(readonly reason: string) {
    super(`Provider unavailable: ${reason}`);
  }
}
