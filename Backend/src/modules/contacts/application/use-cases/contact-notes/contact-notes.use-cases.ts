import { Inject, Injectable } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../../../shared/application/actor-context';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import {
  TENANT_CONTEXT,
  type TenantContext,
} from '../../../../../shared/application/tenant-context';
import { ContactNote } from '../../../domain/contact-note.entity';
import { ContactNotFoundError } from '../../../domain/errors/contact-not-found.error';
import { NoteNotFoundError } from '../../../domain/errors/note-not-found.error';
import {
  CONTACT_NOTE_REPOSITORY,
  type ContactNoteRepository,
} from '../../ports/contact-note.repository';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';

/** O contato precisa existir no tenant (senão 404 — sem revelar de outro tenant). */
async function ensureContact(contacts: ContactRepository, contactId: string): Promise<void> {
  if (!(await contacts.findById(contactId))) throw new ContactNotFoundError(contactId);
}

@Injectable()
export class ListContactNotesUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(CONTACT_NOTE_REPOSITORY) private readonly notes: ContactNoteRepository,
  ) {}

  async execute(contactId: string): Promise<ContactNote[]> {
    await ensureContact(this.contacts, contactId);
    return this.notes.listByContact(contactId);
  }
}

/** O autor é o membro autenticado — nunca um id vindo do cliente. */
@Injectable()
export class AddContactNoteUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(CONTACT_NOTE_REPOSITORY) private readonly notes: ContactNoteRepository,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { contactId: string; body: string }): Promise<ContactNote> {
    await ensureContact(this.contacts, input.contactId);
    const note = ContactNote.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      contactId: input.contactId,
      authorMembershipId: this.actors.actor.membershipId,
      body: input.body,
    });
    await this.notes.save(note);
    return note;
  }
}

@Injectable()
export class DeleteContactNoteUseCase {
  constructor(
    @Inject(CONTACT_NOTE_REPOSITORY) private readonly notes: ContactNoteRepository,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  async execute(input: { contactId: string; noteId: string }): Promise<void> {
    const note = await this.notes.findById(input.noteId);
    if (!note || note.contactId !== input.contactId) throw new NoteNotFoundError();
    note.assertCanDelete(this.actors.actor.membershipId);
    await this.notes.delete(note);
  }
}
