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
  CancelCampaignUseCase,
  CreateCampaignUseCase,
  DeleteCampaignUseCase,
  GetCampaignUseCase,
  ListCampaignRecipientsUseCase,
  ListCampaignsUseCase,
  PreviewAudienceUseCase,
  ScheduleCampaignUseCase,
  UnscheduleCampaignUseCase,
  UpdateCampaignUseCase,
} from '../application/use-cases/campaigns.use-cases';
import { CampaignPresenter } from './campaign.presenter';
import {
  createCampaignSchema,
  listCampaignsQuerySchema,
  previewAudienceSchema,
  recipientsQuerySchema,
  scheduleCampaignSchema,
  updateCampaignSchema,
  type CreateCampaignDto,
  type ListCampaignsQuery,
  type PreviewAudienceDto,
  type RecipientsQuery,
  type ScheduleCampaignDto,
  type UpdateCampaignDto,
} from './dto/campaign.dto';

const idParam = new ZodValidationPipe(z.uuid());

/** Campanhas de e-mail/SMS. Tudo exige `campaigns:manage`. */
@RequirePermissions('campaigns:manage')
@Controller('v1/campaigns')
export class CampaignsController {
  constructor(
    private readonly listCampaigns: ListCampaignsUseCase,
    private readonly getCampaign: GetCampaignUseCase,
    private readonly createCampaign: CreateCampaignUseCase,
    private readonly updateCampaign: UpdateCampaignUseCase,
    private readonly scheduleCampaign: ScheduleCampaignUseCase,
    private readonly unscheduleCampaign: UnscheduleCampaignUseCase,
    private readonly cancelCampaign: CancelCampaignUseCase,
    private readonly deleteCampaign: DeleteCampaignUseCase,
    private readonly previewAudience: PreviewAudienceUseCase,
    private readonly listRecipients: ListCampaignRecipientsUseCase,
  ) {}

  @Get()
  async list(@Query(new ZodValidationPipe(listCampaignsQuerySchema)) query: ListCampaignsQuery) {
    const page = await this.listCampaigns.execute(query);
    return { items: page.items.map(CampaignPresenter.toHttp), nextCursor: page.nextCursor };
  }

  /** Quantos contatos o público pega e quantos têm endereço no canal. */
  @Post('preview-audience')
  @HttpCode(HttpStatus.OK)
  preview(@Body(new ZodValidationPipe(previewAudienceSchema)) body: PreviewAudienceDto) {
    return this.previewAudience.execute(body.channel, body.audience);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createCampaignSchema)) body: CreateCampaignDto) {
    return CampaignPresenter.toHttp(await this.createCampaign.execute(body));
  }

  /** A campanha com as contagens por status. */
  @Get(':id')
  async get(@Param('id', idParam) id: string) {
    return CampaignPresenter.report(await this.getCampaign.execute(id));
  }

  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateCampaignSchema)) body: UpdateCampaignDto,
  ) {
    return CampaignPresenter.toHttp(await this.updateCampaign.execute(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deleteCampaign.execute(id);
  }

  /** Agendar (`at`) ou enviar agora (`at: null`). */
  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  async schedule(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(scheduleCampaignSchema)) body: ScheduleCampaignDto,
  ) {
    return CampaignPresenter.toHttp(
      await this.scheduleCampaign.execute(id, body.at ? new Date(body.at) : null),
    );
  }

  @Post(':id/unschedule')
  @HttpCode(HttpStatus.OK)
  async unschedule(@Param('id', idParam) id: string) {
    return CampaignPresenter.toHttp(await this.unscheduleCampaign.execute(id));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id', idParam) id: string) {
    return CampaignPresenter.toHttp(await this.cancelCampaign.execute(id));
  }

  @Get(':id/recipients')
  async recipients(
    @Param('id', idParam) id: string,
    @Query(new ZodValidationPipe(recipientsQuerySchema)) query: RecipientsQuery,
  ) {
    const page = await this.listRecipients.execute(id, query);
    return { items: page.items.map(CampaignPresenter.recipient), nextCursor: page.nextCursor };
  }
}
