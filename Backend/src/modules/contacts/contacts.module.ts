import { Module } from '@nestjs/common';
import { ContactsFacade } from './application/contacts.facade';
import { CONTACT_REPOSITORY } from './application/ports/contact.repository';
import { CreateContactUseCase } from './application/use-cases/create-contact/create-contact.use-case';
import { GetContactUseCase } from './application/use-cases/get-contact/get-contact.use-case';
import { ListContactsUseCase } from './application/use-cases/list-contacts/list-contacts.use-case';
import { ContactsController } from './http/contacts.controller';
import { PrismaContactRepository } from './infra/prisma-contact.repository';

@Module({
  controllers: [ContactsController],
  providers: [
    CreateContactUseCase,
    GetContactUseCase,
    ListContactsUseCase,
    ContactsFacade,
    // O único lugar que sabe que o repositório é Prisma.
    { provide: CONTACT_REPOSITORY, useClass: PrismaContactRepository },
  ],
  exports: [ContactsFacade],
})
export class ContactsModule {}
