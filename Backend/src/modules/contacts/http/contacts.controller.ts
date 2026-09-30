import {
  BadRequestException,
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
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermissions } from '../../accounts';
import {
  AddContactNoteUseCase,
  DeleteContactNoteUseCase,
  ListContactNotesUseCase,
} from '../application/use-cases/contact-notes/contact-notes.use-cases';
import { CreateContactUseCase } from '../application/use-cases/create-contact/create-contact.use-case';
import { ImportContactsUseCase } from '../application/use-cases/import-contacts/import-contacts.use-case';
import { GetContactUseCase } from '../application/use-cases/get-contact/get-contact.use-case';
import {
  ListContactsUseCase,
  ListSourceDetailsUseCase,
} from '../application/use-cases/list-contacts/list-contacts.use-case';
import { UpdateContactUseCase } from '../application/use-cases/update-contact/update-contact.use-case';
import { ContactNotePresenter, ContactPresenter } from './contact.presenter';
import {
  addNoteSchema,
  createContactSchema,
  updateContactSchema,
  type AddNoteDto,
  type CreateContactDto,
  type UpdateContactDto,
} from './dto/create-contact.dto';
import { listContactsQuerySchema, type ListContactsQuery } from './dto/list-contacts.query';

const idParam = new ZodValidationPipe(z.uuid());

// Autenticação e vínculo ativo: guards globais (o tenant vem do token).
@RequirePermissions('contacts:view')
@Controller('v1/contacts')
export class ContactsController {
  constructor(
    private readonly createContact: CreateContactUseCase,
    private readonly getContact: GetContactUseCase,
    private readonly listContacts: ListContactsUseCase,
    private readonly listSourceDetails: ListSourceDetailsUseCase,
    private readonly updateContact: UpdateContactUseCase,
    private readonly listNotes: ListContactNotesUseCase,
    private readonly addNote: AddContactNoteUseCase,
    private readonly deleteNote: DeleteContactNoteUseCase,
    private readonly importContacts: ImportContactsUseCase,
  ) {}

  @Post()
  @RequirePermissions('contacts:edit')
  async create(@Body(new ZodValidationPipe(createContactSchema)) body: CreateContactDto) {
    return ContactPresenter.toHttp(await this.createContact.execute(body));
  }

  @Get()
  async list(@Query(new ZodValidationPipe(listContactsQuerySchema)) query: ListContactsQuery) {
    const page = await this.listContacts.execute({
      limit: query.limit,
      cursor: query.cursor,
      search: query.q || undefined,
      source: query.source,
      sourceDetail: query.sourceDetail || undefined,
    });
    return { items: page.items.map(ContactPresenter.toHttp), nextCursor: page.nextCursor };
  }

  /** Detalhes de origem em uso (campanhas do site, lotes de importação), com contagem. */
  @Get('source-details')
  sourceDetails() {
    return this.listSourceDetails.execute();
  }

  /**
   * Importação de planilha CSV (multipart: campo 'label' opcional ANTES do
   * 'file'). Responde com o relatório: criados, duplicados e erros por linha.
   */
  @Post('import')
  @RequirePermissions('contacts:edit')
  async import(@Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException({ code: 'IMPORT_FILE_MISSING', message: 'No file sent' });
    }
    const label = file.fields.label;
    return this.importContacts.execute({
      content: await file.toBuffer(),
      label: label && !Array.isArray(label) && label.type === 'field' ? String(label.value) : null,
    });
  }

  @Get(':id')
  async get(@Param('id', idParam) id: string) {
    return ContactPresenter.toHttp(await this.getContact.execute(id));
  }

  @Patch(':id')
  @RequirePermissions('contacts:edit')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactDto,
  ) {
    return ContactPresenter.toHttp(await this.updateContact.execute({ id, ...body }));
  }

  @Get(':id/notes')
  async notes(@Param('id', idParam) id: string) {
    return (await this.listNotes.execute(id)).map(ContactNotePresenter.toHttp);
  }

  @Post(':id/notes')
  @RequirePermissions('contacts:edit')
  async note(
    @Param('id', idParam) contactId: string,
    @Body(new ZodValidationPipe(addNoteSchema)) body: AddNoteDto,
  ) {
    return ContactNotePresenter.toHttp(await this.addNote.execute({ contactId, body: body.body }));
  }

  /** Só o autor apaga (403 CONTACT_NOTE_NOT_YOURS para os demais). */
  @Delete(':id/notes/:noteId')
  @RequirePermissions('contacts:edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeNote(
    @Param('id', idParam) contactId: string,
    @Param('noteId', idParam) noteId: string,
  ) {
    await this.deleteNote.execute({ contactId, noteId });
  }
}
