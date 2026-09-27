import type { Channel } from '../../domain/channel.entity';

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface ChannelRepository {
  save(channel: Channel): Promise<void>;
  findById(id: string): Promise<Channel | null>;
  findByIds(ids: string[]): Promise<Channel[]>;
  list(): Promise<Channel[]>;
  delete(channel: Channel): Promise<void>;
}

export const CHANNEL_REPOSITORY = Symbol('ChannelRepository');
