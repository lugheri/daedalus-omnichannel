import { apexOf } from '../domain/site-domain';
import type { SiteHosting } from './ports/site-hosting';

/** Arquivo que prova que o domínio chega no site: contém o id do site. */
export const DOMAIN_CHECK_PATH = '.well-known/daedalus-site.txt';

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Página do domínio sem "www": manda para o principal. Meta refresh
 * imediato (o Google trata como redirecionamento permanente) + canonical.
 */
export function redirectPage(url: string): string {
  const href = escapeAttr(url);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${href}"><link rel="canonical" href="${href}"><title>Redirecionando…</title></head><body><a href="${href}">${href}</a></body></html>`;
}

/** As pastas do domínio próprio no bucket: o site, a verificação e o redirecionamento. */
export async function publishDomainFolder(
  hosting: SiteHosting,
  domain: string,
  html: string,
  siteId: string,
): Promise<void> {
  await hosting.publishPage(domain, html);
  await hosting.publishFile(domain, DOMAIN_CHECK_PATH, siteId, 'text/plain; charset=utf-8');
  const apex = apexOf(domain);
  if (apex) await hosting.publishPage(apex, redirectPage(`${hosting.domainUrl(domain)}/`));
}

export async function removeDomainFolder(hosting: SiteHosting, domain: string): Promise<void> {
  await hosting.removePage(domain);
  await hosting.removeFile(domain, DOMAIN_CHECK_PATH);
  const apex = apexOf(domain);
  if (apex) await hosting.removePage(apex);
}
