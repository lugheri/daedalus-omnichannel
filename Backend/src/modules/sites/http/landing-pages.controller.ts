import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  AddLandingVariantUseCase,
  ChooseLandingWinnerUseCase,
  CreateLandingPageUseCase,
  DeleteLandingPageUseCase,
  GetLandingPageUseCase,
  LandingStatsUseCase,
  ListLandingPagesUseCase,
  PreviewLandingUseCase,
  RemoveLandingVariantUseCase,
  RequestLandingPublicationUseCase,
  ResetLandingStatsUseCase,
  UpdateLandingPageUseCase,
  UpdateLandingVariantUseCase,
  type LandingDetails,
} from '../application/use-cases/landing-pages.use-cases';
import type { LandingPage } from '../domain/landing-page.entity';
import {
  addVariantSchema,
  createLandingSchema,
  previewLandingSchema,
  updateLandingSchema,
  updateVariantSchema,
} from './dto/sites.dto';

const idParam = new ZodValidationPipe(z.uuid());

const presentStatus = (page: LandingPage) => ({
  isLive: page.isLive,
  isTesting: page.isTesting,
  hasUnpublishedChanges: page.hasUnpublishedChanges,
  pendingAction: page.pendingAction,
  lastError: page.lastError,
  publishedAt: page.publishedAt?.toISOString() ?? null,
});

function presentDetails({ page, url, templates }: LandingDetails) {
  return {
    id: page.id,
    name: page.name,
    path: page.path,
    url,
    formId: page.formId,
    ...presentStatus(page),
    variants: page.variants.map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      templateId: v.templateId,
      templateName: templates.get(v.templateId)?.name ?? null,
      content: v.content,
      weight: v.weight,
      updatedAt: v.updatedAt.toISOString(),
    })),
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

/**
 * Landing pages da conta (ADR 0014), `sites:manage`. Moram no endereço do
 * site; editar mexe no rascunho, publicar vai para a fila (estado em
 * `pendingAction`/`lastError`), como o site.
 */
@Controller('v1/landing-pages')
@RequirePermissions('sites:manage')
export class LandingPagesController {
  constructor(
    private readonly listPages: ListLandingPagesUseCase,
    private readonly getPage: GetLandingPageUseCase,
    private readonly createPage: CreateLandingPageUseCase,
    private readonly updatePage: UpdateLandingPageUseCase,
    private readonly deletePage: DeleteLandingPageUseCase,
    private readonly addVariant: AddLandingVariantUseCase,
    private readonly updateVariant: UpdateLandingVariantUseCase,
    private readonly removeVariant: RemoveLandingVariantUseCase,
    private readonly chooseWinner: ChooseLandingWinnerUseCase,
    private readonly previewPage: PreviewLandingUseCase,
    private readonly requestPublication: RequestLandingPublicationUseCase,
    private readonly pageStats: LandingStatsUseCase,
    private readonly resetStats: ResetLandingStatsUseCase,
  ) {}

  /** As páginas com visitas e conversões somadas; `hasSite`: sem site não dá para criar. */
  @Get()
  async list() {
    const { hasSite, pages } = await this.listPages.execute();
    return {
      hasSite,
      items: pages.map(({ page, url, numbers }) => ({
        id: page.id,
        name: page.name,
        path: page.path,
        url,
        variants: page.variants.length,
        ...presentStatus(page),
        views: numbers.views,
        conversions: numbers.conversions,
        createdAt: page.createdAt.toISOString(),
      })),
    };
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createLandingSchema)) body: z.infer<typeof createLandingSchema>,
  ) {
    return presentDetails(await this.createPage.execute(body));
  }

  @Get(':id')
  async get(@Param('id', idParam) id: string) {
    return presentDetails(await this.getPage.execute(id));
  }

  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateLandingSchema)) body: z.infer<typeof updateLandingSchema>,
  ) {
    return presentDetails(await this.updatePage.execute(id, body));
  }

  /** Só fora do ar (409 `LANDING_IS_LIVE`). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deletePage.execute(id);
  }

  /** Variante nova, cópia de `copyFrom` (padrão: a primeira). */
  @Post(':id/variants')
  async createVariant(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(addVariantSchema)) body: z.infer<typeof addVariantSchema>,
  ) {
    const { details, variant } = await this.addVariant.execute(id, body);
    return { ...presentDetails(details), createdVariantId: variant.id };
  }

  @Patch(':id/variants/:variantId')
  async editVariant(
    @Param('id', idParam) id: string,
    @Param('variantId', idParam) variantId: string,
    @Body(new ZodValidationPipe(updateVariantSchema)) body: z.infer<typeof updateVariantSchema>,
  ) {
    return presentDetails(await this.updateVariant.execute(id, variantId, body));
  }

  @Delete(':id/variants/:variantId')
  async deleteVariant(
    @Param('id', idParam) id: string,
    @Param('variantId', idParam) variantId: string,
  ) {
    return presentDetails(await this.removeVariant.execute(id, variantId));
  }

  /** Fim do teste: só ela fica com o tráfego (no ar, já publica). */
  @Post(':id/variants/:variantId/winner')
  @HttpCode(HttpStatus.OK)
  async winner(@Param('id', idParam) id: string, @Param('variantId', idParam) variantId: string) {
    return presentDetails(await this.chooseWinner.execute(id, variantId));
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(previewLandingSchema)) body: z.infer<typeof previewLandingSchema>,
  ) {
    return { html: await this.previewPage.execute(id, body) };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.ACCEPTED)
  async publish(@Param('id', idParam) id: string) {
    return presentDetails(await this.requestPublication.execute(id, 'publish'));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.ACCEPTED)
  async unpublish(@Param('id', idParam) id: string) {
    return presentDetails(await this.requestPublication.execute(id, 'unpublish'));
  }

  /** Visitas, conversões e taxa por variante, comparadas com a A. */
  @Get(':id/stats')
  async stats(@Param('id', idParam) id: string) {
    const { variants } = await this.pageStats.execute(id);
    return variants.map(({ variant, numbers, rate, comparison }) => ({
      variantId: variant.id,
      code: variant.code,
      name: variant.name,
      weight: variant.weight,
      views: numbers.views,
      conversions: numbers.conversions,
      rate,
      comparison,
    }));
  }

  @Post(':id/stats/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Param('id', idParam) id: string) {
    await this.resetStats.execute(id);
  }
}
