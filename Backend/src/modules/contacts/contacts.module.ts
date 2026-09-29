import { Module } from '@nestjs/common';
import { ContactsFacade } from './application/contacts.facade';
import { CONTACT_NOTE_REPOSITORY } from './application/ports/contact-note.repository';
import { CONTACT_REPOSITORY } from './application/ports/contact.repository';
import {
  AddContactNoteUseCase,
  DeleteContactNoteUseCase,
  ListContactNotesUseCase,
} from './application/use-cases/contact-notes/contact-notes.use-cases';
import { CreateContactUseCase } from './application/use-cases/create-contact/create-contact.use-case';
import { GetContactUseCase } from './application/use-cases/get-contact/get-contact.use-case';
import { ListContactsUseCase } from './application/use-cases/list-contacts/list-contacts.use-case';
import { UpdateContactUseCase } from './application/use-cases/update-contact/update-contact.use-case';
import { ContactsController } from './http/contacts.controller';
import { PrismaContactNoteRepository } from './infra/prisma-contact-note.repository';
import { PrismaContactRepository } from './infra/prisma-contact.repository';

@Module({
  controllers: [ContactsController],
  providers: [
    CreateContactUseCase,
    GetContactUseCase,
    ListContactsUseCase,
    UpdateContactUseCase,
    ListContactNotesUseCase,
    AddContactNoteUseCase,
    DeleteContactNoteUseCase,
    ContactsFacade,
    // O único lugar que sabe que os repositórios são Prisma.
    { provide: CONTACT_REPOSITORY, useClass: PrismaContactRepository },
    { provide: CONTACT_NOTE_REPOSITORY, useClass: PrismaContactNoteRepository },
  ],
  exports: [ContactsFacade],
})
export class ContactsModule {}
