import { defineJob } from '../../../shared/application/job-queue';

export const SITES_QUEUE = 'sites';

/**
 * Faz o que o site tem pendente (`pendingAction`: publicar ou tirar do ar).
 * O job não diz o quê: lê o estado na hora — job repetido ou fora de ordem
 * não desfaz o pedido mais recente.
 */
export const ProcessSiteJob = defineJob<{ siteId: string }>(SITES_QUEUE, 'process-site');

/** Confere se o domínio próprio do site já chega nele (ADR 0011). */
export const CheckSiteDomainJob = defineJob<{ siteId: string }>(SITES_QUEUE, 'check-domain');

/** Faz o que a landing page tem pendente (publicar ou tirar do ar; ADR 0014). */
export const ProcessLandingJob = defineJob<{ landingPageId: string }>(
  SITES_QUEUE,
  'process-landing',
);
