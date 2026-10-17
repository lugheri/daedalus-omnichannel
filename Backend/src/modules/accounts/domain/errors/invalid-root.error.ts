import { DomainError } from '../../../../shared/domain/domain-error';

/** Definir a conta da plataforma: já existe outra, ou a escolhida tem mãe. */
export class InvalidRootError extends DomainError {
  constructor(readonly code: 'ROOT_ALREADY_DEFINED' | 'ROOT_HAS_PARENT' | 'ROOT_NOT_FOUND') {
    super(`Invalid root account: ${code}`);
  }
}
