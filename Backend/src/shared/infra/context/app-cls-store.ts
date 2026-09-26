import type { ClsStore } from 'nestjs-cls';

/** Tudo que fica guardado no contexto de uma operação (requisição, job...). */
export interface AppClsStore extends ClsStore {
  tenantId?: string;
}
