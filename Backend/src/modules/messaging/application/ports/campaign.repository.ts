import type { Campaign } from '../../domain/campaign.entity';

/** Campanhas (tenant atual), exceto o que diz "AllTenants". */
export interface CampaignRepository {
  save(campaign: Campaign): Promise<void>;
  findById(id: string): Promise<Campaign | null>;
  /** Mais recentes primeiro. */
  list(page: {
    cursor?: string;
    limit: number;
  }): Promise<{ items: Campaign[]; nextCursor: string | null }>;
  delete(campaign: Campaign): Promise<void>;
  /** Agendadas que já venceram, de TODAS as contas (a varredura do worker). */
  listDueAllTenants(now: Date): Promise<{ id: string; tenantId: string }[]>;
}

export const CAMPAIGN_REPOSITORY = Symbol('CampaignRepository');
