import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AccountsModule } from '../accounts';
import { CatalogModule } from '../catalog';
import { FormsModule } from '../forms';
import { SITE_ASSET_REPOSITORY } from './application/ports/site-asset.repository';
import { SITE_DOMAIN_CHECKER } from './application/ports/site-domain-checker';
import { SITE_HOSTING } from './application/ports/site-hosting';
import { SITE_RENDERER } from './application/ports/site-renderer';
import { SITE_ACCOUNT, SITE_SOURCES } from './application/ports/site-sources';
import { SITE_TEMPLATE_REPOSITORY } from './application/ports/site-template.repository';
import { SITE_REPOSITORY } from './application/ports/site.repository';
import { SiteComposer } from './application/site-composer';
import { SITES_QUEUE } from './application/sites-jobs';
import {
  DeleteSiteAssetUseCase,
  ListSiteAssetsUseCase,
  UploadSiteAssetUseCase,
} from './application/use-cases/site-assets.use-cases';
import {
  CreateSiteTemplateUseCase,
  DeleteSiteTemplateUseCase,
  GetSiteTemplateUseCase,
  ListAvailableTemplatesUseCase,
  ListSiteTemplatesUseCase,
  PreviewSiteTemplateUseCase,
  TemplateKeeper,
  UpdateSiteTemplateUseCase,
} from './application/use-cases/site-templates.use-cases';
import {
  CheckSiteDomainUseCase,
  CreateSiteUseCase,
  GetSiteUseCase,
  GiveUpSiteUseCase,
  PreviewSiteUseCase,
  ProcessSiteUseCase,
  RequestSiteDomainCheckUseCase,
  RequestSitePublicationUseCase,
  UpdateSiteUseCase,
} from './application/use-cases/site.use-cases';
import { SiteTemplatesController } from './http/site-templates.controller';
import { SiteController } from './http/site.controller';
import { AccountsSiteAccount, FacadeSiteSources } from './infra/gateways';
import { HttpSiteDomainChecker } from './infra/http-site-domain-checker';
import { MustacheSiteRenderer } from './infra/mustache-site-renderer';
import {
  PrismaSiteAssetRepository,
  PrismaSiteRepository,
  PrismaSiteTemplateRepository,
} from './infra/prisma-sites.repositories';
import { S3SiteHosting } from './infra/s3-site-hosting';
import { SITES_SETTINGS, type SitesSettings } from './infra/sites-settings';

/**
 * Sites das contas (ADR 0010): modelos (HTML com marcadores, mantidos na
 * conta da plataforma), o site de cada conta, prévia e publicação no bucket
 * público de sites (ADR 0008) pela fila `sites`.
 */
@Module({
  imports: [
    AccountsModule,
    CatalogModule,
    FormsModule,
    BullModule.registerQueue({ name: SITES_QUEUE }),
  ],
  controllers: [SiteTemplatesController, SiteController],
  providers: [
    TemplateKeeper,
    ListSiteTemplatesUseCase,
    GetSiteTemplateUseCase,
    CreateSiteTemplateUseCase,
    UpdateSiteTemplateUseCase,
    DeleteSiteTemplateUseCase,
    PreviewSiteTemplateUseCase,
    ListAvailableTemplatesUseCase,
    GetSiteUseCase,
    CreateSiteUseCase,
    UpdateSiteUseCase,
    PreviewSiteUseCase,
    RequestSitePublicationUseCase,
    ProcessSiteUseCase,
    GiveUpSiteUseCase,
    RequestSiteDomainCheckUseCase,
    CheckSiteDomainUseCase,
    ListSiteAssetsUseCase,
    UploadSiteAssetUseCase,
    DeleteSiteAssetUseCase,
    SiteComposer,
    { provide: SITE_TEMPLATE_REPOSITORY, useClass: PrismaSiteTemplateRepository },
    { provide: SITE_REPOSITORY, useClass: PrismaSiteRepository },
    { provide: SITE_ASSET_REPOSITORY, useClass: PrismaSiteAssetRepository },
    { provide: SITE_HOSTING, useClass: S3SiteHosting },
    { provide: SITE_RENDERER, useClass: MustacheSiteRenderer },
    { provide: SITE_DOMAIN_CHECKER, useClass: HttpSiteDomainChecker },
    { provide: SITE_SOURCES, useClass: FacadeSiteSources },
    { provide: SITE_ACCOUNT, useClass: AccountsSiteAccount },
    {
      provide: SITES_SETTINGS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): SitesSettings => {
        const sites = config.sites;
        const { region, endpoint, forcePathStyle } = config.storage;
        return {
          hosting: sites ? { ...sites, region, endpoint, forcePathStyle } : null,
          publicApiUrl: config.publicApiUrl,
          domainTarget: config.siteDomains.target,
          domainCheckVia: config.siteDomains.checkVia,
        };
      },
    },
  ],
  exports: [ProcessSiteUseCase, GiveUpSiteUseCase, CheckSiteDomainUseCase],
})
export class SitesModule {}
