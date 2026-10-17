import { InvalidSiteError } from './errors/invalid-site.error';

/** Fotos de site: acima disso o site fica lento no celular. */
export const MAX_SITE_ASSET_BYTES = 5 * 1024 * 1024;

/** Só imagens comuns (SVG fica de fora: pode carregar script). */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Imagem enviada para o site (logo, capa, galeria). */
export interface SiteAsset {
  id: string;
  tenantId: string;
  fileName: string | null;
  contentType: string;
  size: number;
  createdAt: Date;
}

export function newSiteAsset(
  id: string,
  input: { tenantId: string; fileName: string | null; contentType: string; size: number },
): SiteAsset {
  if (!(input.contentType in EXTENSIONS)) throw new InvalidSiteError('SITE_ASSET_INVALID_TYPE');
  if (input.size > MAX_SITE_ASSET_BYTES) throw new InvalidSiteError('SITE_ASSET_TOO_LARGE');
  return {
    id,
    tenantId: input.tenantId,
    fileName: input.fileName?.trim().slice(0, 200) || null,
    contentType: input.contentType,
    size: input.size,
    createdAt: new Date(),
  };
}

/** Original no bucket privado (com backup). */
export function privateAssetKey(asset: SiteAsset): string {
  return `tenants/${asset.tenantId}/site-assets/${asset.id}`;
}

/** Cópia pública, servida em `media.<SITES_DOMAIN>/<tenant>/<id>.<ext>`. */
export function publicAssetKey(asset: SiteAsset): string {
  return `${asset.tenantId}/${asset.id}.${EXTENSIONS[asset.contentType] ?? 'bin'}`;
}
