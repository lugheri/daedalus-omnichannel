/** Configuração da infra do sites, montada do env no `sites.module.ts`. */
export interface SitesSettings {
  /** Bucket público de sites; null = publicação desligada (SITES_NOT_CONFIGURED). */
  hosting: {
    bucket: string;
    /** Endereço de cada site, com `{slug}` no lugar do subdomínio. */
    urlPattern: string;
    publicAcl: boolean;
    accessKeyId: string;
    secretAccessKey: string;
    /** Mesmo endpoint e região do bucket privado. */
    region: string;
    endpoint: string | undefined;
    forcePathStyle: boolean;
  } | null;
  /** Origem da API pública (o `action` dos formulários do site). */
  publicApiUrl: string;
}

export const SITES_SETTINGS = Symbol('SitesSettings');
