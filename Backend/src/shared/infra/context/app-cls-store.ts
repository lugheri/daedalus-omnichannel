import type { ClsStore } from 'nestjs-cls';
import type { Actor } from '../../application/actor-context';

/** Tudo que fica guardado no contexto de uma operação (requisição, job...). */
export interface AppClsStore extends ClsStore {
  actor?: Actor;
}
