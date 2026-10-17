import { InvalidSiteError } from './errors/invalid-site.error';

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/** TLD de letras (ou IDN em punycode): IP não passa. */
const TLD = /^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export type SiteDomainStatus = 'pending' | 'checking' | 'connected' | 'unreachable';

/**
 * Domínio próprio de um site (ADR 0011), como a pessoa colar: aceita
 * "https://www.Barbearia.com.br/" e devolve "www.barbearia.com.br" (acentos
 * em punycode). Recusa IP, nome sem ponto e subdomínios do nosso domínio de
 * sites (para esses, o endereço do site já serve).
 */
export function validCustomDomain(raw: string, sitesDomain: string | null): string {
  const typed = raw.trim().replace(/^[a-z]+:\/\//i, '');
  if (!typed || typed.includes('@')) throw new InvalidSiteError('SITE_INVALID_DOMAIN');
  // O URL do próprio runtime tira caminho e porta, põe em minúsculas e
  // converte acentos para punycode (www.açaí.com.br → www.xn--aa-4iaz.com.br).
  let ascii: string;
  try {
    ascii = new URL(`http://${typed}`).hostname.replace(/\.$/, '');
  } catch {
    throw new InvalidSiteError('SITE_INVALID_DOMAIN');
  }
  const labels = ascii.split('.');
  if (
    !ascii ||
    ascii.length > 253 ||
    labels.length < 2 ||
    !labels.every((label) => LABEL.test(label)) ||
    !TLD.test(labels[labels.length - 1])
  ) {
    throw new InvalidSiteError('SITE_INVALID_DOMAIN');
  }
  // "Nosso" é o que o nginx serve pelo slug: um rótulo direto sob o domínio dos
  // sites (loja.meusites.com.br). Em dev o domínio é "localhost", e o domínio
  // de teste www.barbearia.localhost precisa passar.
  const ours =
    sitesDomain !== null &&
    (ascii === sitesDomain ||
      (ascii.endsWith(`.${sitesDomain}`) &&
        !ascii.slice(0, -sitesDomain.length - 1).includes('.')));
  if (ours) {
    throw new InvalidSiteError('SITE_DOMAIN_IS_OURS');
  }
  return ascii;
}

/**
 * O domínio sem o "www.", que redireciona para o principal
 * (barbearia.com.br → www.barbearia.com.br). Só para domínio com www.
 */
export function apexOf(domain: string): string | null {
  const apex = domain.startsWith('www.') ? domain.slice(4) : null;
  return apex && apex.includes('.') ? apex : null;
}

/** As formas do mesmo domínio que dois sites não podem dividir (com e sem www). */
export function domainVariants(domain: string): string[] {
  const apex = apexOf(domain);
  return apex ? [domain, apex] : [domain, `www.${domain}`];
}
