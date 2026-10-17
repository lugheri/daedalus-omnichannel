import { InvalidSiteError } from './errors/invalid-site.error';

/** Mesmo formato que o nginx e o Traefik aceitam no subdomínio (rótulo DNS). */
const SLUG = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;

/**
 * Subdomínios que não podem virar site: `media` é onde ficam as imagens dos
 * sites (`media.<SITES_DOMAIN>`); os outros evitam confusão com serviços.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'media',
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'email',
  'smtp',
  'imap',
  'pop',
  'ftp',
  'cdn',
  'static',
  'assets',
  'status',
  'help',
  'ajuda',
  'suporte',
  'blog',
  'site',
  'sites',
  'docs',
  'ns1',
  'ns2',
]);

/** Valida o endereço escolhido (3 a 63 caracteres: letras minúsculas, números e hífen). */
export function validSiteSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (!SLUG.test(slug)) throw new InvalidSiteError('SITE_INVALID_SLUG');
  if (RESERVED_SLUGS.has(slug)) throw new InvalidSiteError('SITE_RESERVED_SLUG');
  return slug;
}

/** Endereço sugerido a partir de um texto qualquer (o slug da conta). */
export function suggestSiteSlug(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  if (base.length < 3 || RESERVED_SLUGS.has(base)) return `${base || 'site'}-site`;
  return base;
}
