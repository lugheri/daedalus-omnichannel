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
  CreateOfferingUseCase,
  CreateProfessionalUseCase,
  DeleteOfferingUseCase,
  DeleteProfessionalUseCase,
  ListOfferingsUseCase,
  ListProfessionalsUseCase,
  UpdateOfferingUseCase,
  UpdateProfessionalUseCase,
} from '../application/use-cases/catalog.use-cases';
import type { Offering } from '../domain/offering.entity';
import type { Professional } from '../domain/professional.entity';
import {
  createProfessionalSchema,
  createServiceSchema,
  updateProfessionalSchema,
  updateServiceSchema,
  type CreateProfessionalDto,
  type CreateServiceDto,
  type UpdateProfessionalDto,
  type UpdateServiceDto,
} from './dto/catalog.dto';

const idParam = new ZodValidationPipe(z.uuid());

const presentService = (offering: Offering) => ({
  id: offering.id,
  name: offering.name,
  description: offering.description,
  durationMinutes: offering.durationMinutes,
  priceCents: offering.priceCents,
  showOnSite: offering.showOnSite,
  active: offering.active,
  createdAt: offering.createdAt.toISOString(),
});

const presentProfessional = (professional: Professional) => ({
  id: professional.id,
  name: professional.name,
  title: professional.title,
  bio: professional.bio,
  membershipId: professional.membershipId,
  serviceIds: [...professional.offeringIds],
  showOnSite: professional.showOnSite,
  active: professional.active,
  createdAt: professional.createdAt.toISOString(),
});

/**
 * Serviços e profissionais. Ler é aberto a todo membro (a agenda e o
 * atendimento precisam); cadastrar exige `catalog:manage`.
 */
@Controller('v1/catalog')
export class CatalogController {
  constructor(
    private readonly listOfferings: ListOfferingsUseCase,
    private readonly createOffering: CreateOfferingUseCase,
    private readonly updateOffering: UpdateOfferingUseCase,
    private readonly deleteOffering: DeleteOfferingUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
    private readonly createProfessional: CreateProfessionalUseCase,
    private readonly updateProfessional: UpdateProfessionalUseCase,
    private readonly deleteProfessional: DeleteProfessionalUseCase,
  ) {}

  @Get('services')
  async services() {
    return (await this.listOfferings.execute()).map(presentService);
  }

  @RequirePermissions('catalog:manage')
  @Post('services')
  async addService(@Body(new ZodValidationPipe(createServiceSchema)) body: CreateServiceDto) {
    return presentService(await this.createOffering.execute(body));
  }

  @RequirePermissions('catalog:manage')
  @Patch('services/:id')
  async editService(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceDto,
  ) {
    return presentService(await this.updateOffering.execute(id, body));
  }

  @RequirePermissions('catalog:manage')
  @Delete('services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeService(@Param('id', idParam) id: string) {
    await this.deleteOffering.execute(id);
  }

  @Get('professionals')
  async professionals() {
    return (await this.listProfessionals.execute()).map(presentProfessional);
  }

  @RequirePermissions('catalog:manage')
  @Post('professionals')
  async addProfessional(
    @Body(new ZodValidationPipe(createProfessionalSchema)) body: CreateProfessionalDto,
  ) {
    const { serviceIds, ...rest } = body;
    return presentProfessional(
      await this.createProfessional.execute({ ...rest, offeringIds: serviceIds }),
    );
  }

  @RequirePermissions('catalog:manage')
  @Patch('professionals/:id')
  async editProfessional(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateProfessionalSchema)) body: UpdateProfessionalDto,
  ) {
    const { serviceIds, ...rest } = body;
    return presentProfessional(
      await this.updateProfessional.execute(id, { ...rest, offeringIds: serviceIds }),
    );
  }

  @RequirePermissions('catalog:manage')
  @Delete('professionals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProfessional(@Param('id', idParam) id: string) {
    await this.deleteProfessional.execute(id);
  }
}
