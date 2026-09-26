import type { Session } from '../../domain/session.entity';

/**
 * Sessões são localizadas pelo id que vem dentro do refresh token, antes de
 * se saber o tenant — por isso não há filtro de tenant aqui.
 */
export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
}

export const SESSION_REPOSITORY = Symbol('SessionRepository');
