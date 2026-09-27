import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import { CreateContactUseCase } from '../application/use-cases/create-contact/create-contact.use-case';
import { GetContactUseCase } from '../application/use-cases/get-contact/get-contact.use-case';
import { ListContactsUseCase } from '../application/use-cases/list-contacts/list-contacts.use-case';
import { ContactPresenter } from './contact.presenter';
import { createContactSchema, type CreateContactDto } from './dto/create-contact.dto';
import { listContactsQuerySchema, type ListContactsQuery } from './dto/list-contacts.query';

// Autenticação e vínculo ativo: guards globais (o tenant vem do token).
@RequirePermissions('contacts:view')
@Controller('v1/contacts')
export class ContactsController {
  constructor(
    private readonly createContact: CreateContactUseCase,
    private readonly getContact: GetContactUseCase,
    private readonly listContacts: ListContactsUseCase,
  ) {}

  @Post()
  @RequirePermissions('contacts:edit')
  async create(@Body(new ZodValidationPipe(createContactSchema)) body: CreateContactDto) {
    const contact = await this.createContact.execute(body);
    return ContactPresenter.toHttp(contact);
  }

  @Get()
  async list(@Query(new ZodValidationPipe(listContactsQuerySchema)) query: ListContactsQuery) {
    const page = await this.listContacts.execute(query);
    return {
      items: page.items.map((contact) => ContactPresenter.toHttp(contact)),
      nextCursor: page.nextCursor,
    };
  }

  @Get(':id')
  async get(@Param('id', new ZodValidationPipe(z.uuid())) id: string) {
    const contact = await this.getContact.execute(id);
    return ContactPresenter.toHttp(contact);
  }
}
