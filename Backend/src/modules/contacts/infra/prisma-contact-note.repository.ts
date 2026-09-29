import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { ContactNoteModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { ContactNoteRepository } from '../application/ports/contact-note.repository';
import { ContactNote } from '../domain/contact-note.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaContactNoteRepository implements ContactNoteRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(note: ContactNote): Promise<void> {
    const data: ContactNoteModel = {
      id: note.id,
      tenantId: this.tenant.tenantId,
      contactId: note.contactId,
      authorMembershipId: note.authorMembershipId,
      body: note.body,
      createdAt: note.createdAt,
    };
    await this.db.contactNote.upsert({ where: { id: note.id }, create: data, update: data });
  }

  async findById(id: string): Promise<ContactNote | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.contactNote.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? toDomain(row) : null;
  }

  async listByContact(contactId: string): Promise<ContactNote[]> {
    const rows = await this.db.contactNote.findMany({
      where: { contactId, tenantId: this.tenant.tenantId },
      orderBy: { id: 'desc' },
      take: 200,
    });
    return rows.map(toDomain);
  }

  async delete(note: ContactNote): Promise<void> {
    await this.db.contactNote.deleteMany({
      where: { id: note.id, tenantId: this.tenant.tenantId },
    });
  }
}

function toDomain(row: ContactNoteModel): ContactNote {
  return ContactNote.restore(row.id, {
    tenantId: row.tenantId,
    contactId: row.contactId,
    authorMembershipId: row.authorMembershipId,
    body: row.body,
    createdAt: row.createdAt,
  });
}
