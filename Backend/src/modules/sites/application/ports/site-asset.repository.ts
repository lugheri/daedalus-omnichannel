import type { SiteAsset } from '../../domain/site-asset';

/** Restrito ao tenant atual. */
export interface SiteAssetRepository {
  save(asset: SiteAsset): Promise<void>;
  findById(id: string): Promise<SiteAsset | null>;
  findByIds(ids: string[]): Promise<SiteAsset[]>;
  /** Mais recentes primeiro. */
  list(): Promise<SiteAsset[]>;
  delete(asset: SiteAsset): Promise<void>;
}

export const SITE_ASSET_REPOSITORY = Symbol('SiteAssetRepository');
