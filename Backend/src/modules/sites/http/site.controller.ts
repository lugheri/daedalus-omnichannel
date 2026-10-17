import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import { SITE_HOSTING, type SiteHosting } from '../application/ports/site-hosting';
import {
  DeleteSiteAssetUseCase,
  ListSiteAssetsUseCase,
  UploadSiteAssetUseCase,
  type SiteAssetWithUrl,
} from '../application/use-cases/site-assets.use-cases';
import {
  CreateSiteUseCase,
  GetSiteUseCase,
  PreviewSiteUseCase,
  RequestSitePublicationUseCase,
  UpdateSiteUseCase,
  type SiteDetails,
} from '../application/use-cases/site.use-cases';
import { createSiteSchema, previewSiteSchema, updateSiteSchema } from './dto/sites.dto';

const presentAsset = ({ asset, url }: SiteAssetWithUrl) => ({
  id: asset.id,
  fileName: asset.fileName,
  contentType: asset.contentType,
  size: asset.size,
  url,
  createdAt: asset.createdAt.toISOString(),
});

/**
 * O site da conta (um por conta; ADR 0010), `sites:manage`. Editar mexe no
 * rascunho; publicar e tirar do ar vão para a fila (o estado aparece em
 * `pendingAction`/`lastError`).
 */
@Controller('v1/site')
@RequirePermissions('sites:manage')
export class SiteController {
  constructor(
    private readonly getSite: GetSiteUseCase,
    private readonly createSite: CreateSiteUseCase,
    private readonly updateSite: UpdateSiteUseCase,
    private readonly previewSite: PreviewSiteUseCase,
    private readonly requestPublication: RequestSitePublicationUseCase,
    private readonly listAssets: ListSiteAssetsUseCase,
    private readonly uploadAsset: UploadSiteAssetUseCase,
    private readonly deleteAsset: DeleteSiteAssetUseCase,
    @Inject(SITE_HOSTING) private readonly hosting: SiteHosting,
  ) {}

  private present({ site, template }: SiteDetails) {
    const url = (slug: string) => (this.hosting.enabled ? this.hosting.siteUrl(slug) : null);
    return {
      id: site.id,
      templateId: site.templateId,
      templateName: template?.name ?? null,
      slug: site.slug,
      url: url(site.slug),
      liveUrl: site.publishedSlug ? url(site.publishedSlug) : null,
      content: site.content,
      isLive: site.isLive,
      hasUnpublishedChanges: site.hasUnpublishedChanges,
      pendingAction: site.pendingAction,
      lastError: site.lastError,
      publishedAt: site.publishedAt?.toISOString() ?? null,
      updatedAt: site.updatedAt.toISOString(),
    };
  }

  /** O site (ou null) e como fica o endereço: `addressPattern` com `{slug}`. */
  @Get()
  async get() {
    const details = await this.getSite.execute();
    return {
      site: details ? this.present(details) : null,
      publishingEnabled: this.hosting.enabled,
      addressPattern: this.hosting.enabled ? this.hosting.siteUrl('{slug}') : null,
    };
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createSiteSchema)) body: z.infer<typeof createSiteSchema>,
  ) {
    return this.present(await this.createSite.execute(body));
  }

  @Patch()
  async update(
    @Body(new ZodValidationPipe(updateSiteSchema)) body: z.infer<typeof updateSiteSchema>,
  ) {
    return this.present(await this.updateSite.execute(body));
  }

  /** O HTML como ficaria (conteúdo em edição, sem gravar), para a prévia. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Body(new ZodValidationPipe(previewSiteSchema)) body: z.infer<typeof previewSiteSchema>,
  ) {
    return { html: await this.previewSite.execute(body) };
  }

  @Post('publish')
  @HttpCode(HttpStatus.ACCEPTED)
  async publish() {
    return this.present(await this.requestPublication.execute('publish'));
  }

  @Post('unpublish')
  @HttpCode(HttpStatus.ACCEPTED)
  async unpublish() {
    return this.present(await this.requestPublication.execute('unpublish'));
  }

  @Get('assets')
  async assets() {
    return (await this.listAssets.execute()).map(presentAsset);
  }

  /** Imagem do site (multipart, campo `file`): JPEG, PNG, WebP ou GIF até 5 MB. */
  @Post('assets')
  async upload(@Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException({ code: 'SITE_ASSET_MISSING', message: 'No file sent' });
    }
    let content: Buffer;
    try {
      content = await file.toBuffer();
    } catch (error) {
      if (error instanceof request.server.multipartErrors.RequestFileTooLargeError) {
        throw new PayloadTooLargeException({
          code: 'SITE_ASSET_TOO_LARGE',
          message: 'File exceeds the size limit',
        });
      }
      throw error;
    }
    return presentAsset(
      await this.uploadAsset.execute({
        content,
        contentType: file.mimetype,
        fileName: file.filename || null,
      }),
    );
  }

  @Delete('assets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAsset(@Param('id', new ZodValidationPipe(z.uuid())) id: string) {
    await this.deleteAsset.execute(id);
  }
}
