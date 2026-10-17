import { defineJob } from '../../../shared/application/job-queue';

export const SITES_QUEUE = 'sites';

/**
 * Faz o que o site tem pendente (`pendingAction`: publicar ou tirar do ar).
 * O job não diz o quê: lê o estado na hora — job repetido ou fora de ordem
 * não desfaz o pedido mais recente.
 */
export const ProcessSiteJob = defineJob<{ siteId: string }>(SITES_QUEUE, 'process-site');
