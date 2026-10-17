import { ForbiddenError } from '../../../../shared/domain/domain-error';

/**
 * Domínio próprio é definido por quem gerencia a conta (acesso da conta-mãe)
 * ou pela conta da plataforma (ADR 0011): o DNS fica na Cloudflare dela, e
 * assim ninguém "reserva" o domínio de outro cliente (403).
 */
export class SiteDomainManagedAboveError extends ForbiddenError {
  readonly code = 'SITE_DOMAIN_MANAGED_ABOVE';

  constructor() {
    super('The custom domain is set by whoever manages the account');
  }
}
