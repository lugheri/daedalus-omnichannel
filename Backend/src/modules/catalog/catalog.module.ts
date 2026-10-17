import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CatalogFacade } from './application/catalog.facade';
import { MEMBER_DIRECTORY } from './application/ports/member-directory';
import { OFFERING_REPOSITORY } from './application/ports/offering.repository';
import { PROFESSIONAL_REPOSITORY } from './application/ports/professional.repository';
import {
  CreateOfferingUseCase,
  CreateProfessionalUseCase,
  DeleteOfferingUseCase,
  DeleteProfessionalUseCase,
  ListOfferingsUseCase,
  ListProfessionalsUseCase,
  ProfessionalReferences,
  UpdateOfferingUseCase,
  UpdateProfessionalUseCase,
} from './application/use-cases/catalog.use-cases';
import { CatalogController } from './http/catalog.controller';
import { AccountsMemberDirectory } from './infra/accounts-member-directory';
import {
  PrismaOfferingRepository,
  PrismaProfessionalRepository,
} from './infra/prisma-catalog.repositories';

/** O que o negócio oferece e quem atende — base da agenda e do site. */
@Module({
  imports: [AccountsModule],
  controllers: [CatalogController],
  providers: [
    ListOfferingsUseCase,
    CreateOfferingUseCase,
    UpdateOfferingUseCase,
    DeleteOfferingUseCase,
    ListProfessionalsUseCase,
    CreateProfessionalUseCase,
    UpdateProfessionalUseCase,
    DeleteProfessionalUseCase,
    ProfessionalReferences,
    CatalogFacade,
    { provide: OFFERING_REPOSITORY, useClass: PrismaOfferingRepository },
    { provide: PROFESSIONAL_REPOSITORY, useClass: PrismaProfessionalRepository },
    { provide: MEMBER_DIRECTORY, useClass: AccountsMemberDirectory },
  ],
  exports: [CatalogFacade],
})
export class CatalogModule {}
