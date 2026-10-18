import type { Channel } from '../../domain/channel.entity';

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface ChannelRepository {
  save(channel: Channel): Promise<void>;
  findById(id: string): Promise<Channel | null>;
  findByIds(ids: string[]): Promise<Channel[]>;
  list(): Promise<Channel[]>;
  delete(channel: Channel): Promise<void>;
  /**
   * Chat do site pela chave pública do widget — SEM filtro de tenant, de
   * propósito: a chave é o que diz a conta (como a chave dos formulários).
   */
  findByPublicKeyAsSystem(publicKey: string): Promise<Channel | null>;
  /** Equipe excluída: os canais dela ficam sem equipe. */
  clearTeam(teamId: string): Promise<void>;
}

export const CHANNEL_REPOSITORY = Symbol('ChannelRepository');
