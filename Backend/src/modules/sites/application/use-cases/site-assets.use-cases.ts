import { Inject, Injectable } from '@nestjs/common';
import { FILE_STORAGE, type FileStorage } from '../../../../shared/application/file-storage';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { InvalidSiteError } from '../../domain/errors/invalid-site.error';
import { SiteConflictError } from '../../domain/errors/site-conflict.error';
import { SiteNotFoundError } from '../../domain/errors/site-not-found.error';
import {
  newSiteAsset,
  privateAssetKey,
  publicAssetKey,
  type SiteAsset,
} from '../../domain/site-asset';
import { referencedAssetIds } from '../../domain/site-content';
import { SITE_ASSET_REPOSITORY, type SiteAssetRepository } from '../ports/site-asset.repository';
import { SITE_HOSTING, type SiteHosting } from '../ports/site-hosting';
import { SITE_REPOSITORY, type SiteRepository } from '../ports/site.repository';

export interface SiteAssetWithUrl {
  asset: SiteAsset;
  url: string | null;
}

@Injectable()
export class ListSiteAssetsUseCase {
  constructor(
    @Inject(SITE_ASSET_REPOSITORY) private readonly assets: SiteAssetRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
  ) {}

  async execute(): Promise<SiteAssetWithUrl[]> {
    return (await this.assets.list()).map((asset) => ({
      asset,
      url: this.hosting.enabled ? this.hosting.mediaUrl(publicAssetKey(asset)) : null,
    }));
  }
}

/**
 * Imagem nova: o original no bucket privado (que tem backup) e a cópia
 * pública que o site usa (`media.<SITES_DOMAIN>`), já na hora — a prévia
 * mostra a imagem antes de publicar.
 */
@Injectable()
export class UploadSiteAssetUseCase {
  constructor(
    @Inject(SITE_ASSET_REPOSITORY) private readonly assets: SiteAssetRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    content: Buffer;
    contentType: string;
    fileName: string | null;
  }): Promise<SiteAssetWithUrl> {
    if (!this.hosting.enabled) throw new InvalidSiteError('SITES_NOT_CONFIGURED');
    const asset = newSiteAsset(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.content.length,
    });
    await this.storage.put(privateAssetKey(asset), input.content, asset.contentType);
    await this.hosting.putMedia(publicAssetKey(asset), input.content, asset.contentType);
    await this.assets.save(asset);
    return { asset, url: this.hosting.mediaUrl(publicAssetKey(asset)) };
  }
}

/**
 * Só imagem que o rascunho não usa. Se a versão no ar ainda usar, ela some de
 * lá também: a tela avisa para publicar de novo.
 */
@Injectable()
export class DeleteSiteAssetUseCase {
  constructor(
    @Inject(SITE_ASSET_REPOSITORY) private readonly assets: SiteAssetRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async execute(id: string): Promise<void> {
    const asset = await this.assets.findById(id);
    if (!asset) throw new SiteNotFoundError('SITE_ASSET_NOT_FOUND');
    const site = await this.sites.findCurrent();
    if (site && referencedAssetIds(site.content).includes(asset.id)) {
      throw new SiteConflictError('SITE_ASSET_IN_USE');
    }
    await this.assets.delete(asset);
    await this.storage.delete(privateAssetKey(asset));
    if (this.hosting.enabled) await this.hosting.removeMedia(publicAssetKey(asset));
  }
}
