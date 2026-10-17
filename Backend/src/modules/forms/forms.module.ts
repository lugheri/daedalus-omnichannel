import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CatalogModule } from '../catalog';
import { ContactsModule } from '../contacts';
import { FormsFacade } from './application/forms.facade';
import { FORM_REPOSITORY } from './application/ports/form.repository';
import { LEAD_GATEWAY } from './application/ports/lead-gateway';
import { PUBLIC_KEY_GENERATOR } from './application/ports/public-key-generator';
import { SERVICE_CATALOG } from './application/ports/service-catalog';
import { SUBMISSION_REPOSITORY } from './application/ports/submission.repository';
import {
  AuthenticateFormKeyUseCase,
  CreateFormUseCase,
  DeleteFormUseCase,
  ListContactSubmissionsUseCase,
  ListFormSubmissionsUseCase,
  ListFormsUseCase,
  SubmitFormUseCase,
  UpdateFormUseCase,
} from './application/use-cases/forms.use-cases';
import { FormKeyGuard } from './http/form-key.guard';
import { FormsController } from './http/forms.controller';
import { PublicFormsController } from './http/public-forms.controller';
import {
  CatalogServiceGateway,
  ContactsLeadGateway,
  RandomPublicKeyGenerator,
} from './infra/gateways';
import {
  PrismaFormRepository,
  PrismaSubmissionRepository,
} from './infra/prisma-forms.repositories';

/**
 * Formulários do site (contato e solicitação de serviço): gestão no CRM e o
 * envio público pela chave do formulário. Cada envio vira contato (contacts)
 * e avisa os funis (`form.submitted.v1`).
 */
@Module({
  imports: [AccountsModule, ContactsModule, CatalogModule],
  controllers: [FormsController, PublicFormsController],
  providers: [
    ListFormsUseCase,
    CreateFormUseCase,
    UpdateFormUseCase,
    DeleteFormUseCase,
    ListFormSubmissionsUseCase,
    ListContactSubmissionsUseCase,
    AuthenticateFormKeyUseCase,
    SubmitFormUseCase,
    FormKeyGuard,
    FormsFacade,
    { provide: FORM_REPOSITORY, useClass: PrismaFormRepository },
    { provide: SUBMISSION_REPOSITORY, useClass: PrismaSubmissionRepository },
    { provide: LEAD_GATEWAY, useClass: ContactsLeadGateway },
    { provide: SERVICE_CATALOG, useClass: CatalogServiceGateway },
    { provide: PUBLIC_KEY_GENERATOR, useClass: RandomPublicKeyGenerator },
  ],
  exports: [FormsFacade],
})
export class FormsModule {}
