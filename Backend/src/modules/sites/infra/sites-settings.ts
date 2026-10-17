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
  /** Destino do CNAME dos domínios próprios (o túnel); null = não configurado. */
  domainTarget: string | null;
  /** Só em dev: `host:porta` onde verificar os domínios (sem DNS). */
  domainCheckVia: string | null;
}

export const SITES_SETTINGS = Symbol('SitesSettings');
