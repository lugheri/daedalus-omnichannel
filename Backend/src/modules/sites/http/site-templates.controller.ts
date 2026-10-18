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
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  CreateSiteTemplateUseCase,
  DeleteSiteTemplateUseCase,
  GetSiteTemplateUseCase,
  ListAvailableTemplatesUseCase,
  ListSiteTemplatesUseCase,
  PreviewSiteTemplateUseCase,
  UpdateSiteTemplateUseCase,
} from '../application/use-cases/site-templates.use-cases';
import type { SiteTemplate } from '../domain/site-template.entity';
import {
  availableTemplatesQuery,
  createTemplateSchema,
  previewTemplateSchema,
  updateTemplateSchema,
} from './dto/sites.dto';

const idParam = new ZodValidationPipe(z.uuid());

const presentTemplate = (template: SiteTemplate, sites?: number) => ({
  id: template.id,
  name: template.name,
  kind: template.kind,
  niche: template.niche,
  description: template.description,
  available: template.available,
  ...(sites === undefined ? {} : { sites }),
  createdAt: template.createdAt.toISOString(),
  updatedAt: template.updatedAt.toISOString(),
});

/**
 * Modelos de site (ADR 0010). Manter modelos (`sites:manage` + conta da
 * plataforma, conferida no use case); `GET available` é para qualquer conta
 * escolher o modelo do próprio site.
 */
@Controller('v1/site-templates')
@RequirePermissions('sites:manage')
export class SiteTemplatesController {
  constructor(
    private readonly listTemplates: ListSiteTemplatesUseCase,
    private readonly getTemplate: GetSiteTemplateUseCase,
    private readonly createTemplate: CreateSiteTemplateUseCase,
    private readonly updateTemplate: UpdateSiteTemplateUseCase,
    private readonly deleteTemplate: DeleteSiteTemplateUseCase,
    private readonly previewTemplate: PreviewSiteTemplateUseCase,
    private readonly listAvailable: ListAvailableTemplatesUseCase,
  ) {}

  /** `?kind=site` (padrão) ou `landing`. */
  @Get('available')
  async available(
    @Query(new ZodValidationPipe(availableTemplatesQuery))
    query: z.infer<typeof availableTemplatesQuery>,
  ) {
    return (await this.listAvailable.execute(query.kind)).map((t) => presentTemplate(t));
  }

  @Get()
  async list() {
    return (await this.listTemplates.execute()).map(({ template, sites }) =>
      presentTemplate(template, sites),
    );
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createTemplateSchema)) body: z.infer<typeof createTemplateSchema>,
  ) {
    const template = await this.createTemplate.execute(body);
    return { ...presentTemplate(template, 0), html: template.html };
  }

  /** HTML em edição com o site de exemplo. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Body(new ZodValidationPipe(previewTemplateSchema)) body: z.infer<typeof previewTemplateSchema>,
  ) {
    return { html: await this.previewTemplate.execute(body.html, body.kind) };
  }

  @Get(':id')
  async get(@Param('id', idParam) id: string) {
    const { template, sites } = await this.getTemplate.execute(id);
    return { ...presentTemplate(template, sites), html: template.html };
  }

  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) body: z.infer<typeof updateTemplateSchema>,
  ) {
    const template = await this.updateTemplate.execute(id, body);
    return { ...presentTemplate(template), html: template.html };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deleteTemplate.execute(id);
  }
}
