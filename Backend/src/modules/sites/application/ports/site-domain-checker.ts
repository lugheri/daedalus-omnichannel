/**
 * Confere se um domínio próprio já chega no site: busca, pelo próprio
 * domínio, o arquivo de verificação publicado e compara o conteúdo.
 */
export interface SiteDomainChecker {
  reaches(domain: string, path: string, expected: string): Promise<boolean>;
}

export const SITE_DOMAIN_CHECKER = Symbol('SiteDomainChecker');
