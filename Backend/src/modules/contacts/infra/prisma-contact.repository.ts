import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import type { CursorPage, PageRequest } from '../../../shared/application/pagination';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { Prisma } from '../../../shared/infra/prisma/generated/client';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { ContactRepository } from '../application/ports/contact.repository';
import type { Contact } from '../domain/contact.entity';
import type { Email } from '../domain/email.vo';
import { ContactAlreadyExistsError } from '../domain/errors/contact-already-exists.error';
import type { Phone } from '../domain/phone.vo';
import { ContactMapper } from './contact.mapper';

const UNIQUE_VIOLATION = 'P2002';

/** Nomes gerados pelo Prisma para os @@unique de contacts.prisma. */
const UNIQUE_CONSTRAINTS = {
  contacts_tenant_id_phone_key: 'phone',
  contacts_tenant_id_email_key: 'email',
} as const;

@Injectable()
export class PrismaContactRepository implements ContactRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  /** Client da transação em andamento (se houver) ou o client normal. */
  private get db() {
    return this.txHost.tx;
  }

  async save(contact: Contact): Promise<void> {
    const data = ContactMapper.toPersistence(contact);
    try {
      await this.db.contact.upsert({
        where: { id: data.id, tenantId: this.tenant.tenantId },
        create: data,
        update: data,
      });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async findById(id: string): Promise<Contact | null> {
    const row = await this.db.contact.findFirst({
      where: { id, tenantId: this.tenant.tenantId },
    });
    return row ? ContactMapper.toDomain(row) : null;
  }

  async findByPhone(phone: Phone): Promise<Contact | null> {
    const row = await this.db.contact.findFirst({
      where: { phone: phone.value, tenantId: this.tenant.tenantId },
    });
    return row ? ContactMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<Contact | null> {
    const row = await this.db.contact.findFirst({
      where: { email: email.value, tenantId: this.tenant.tenantId },
    });
    return row ? ContactMapper.toDomain(row) : null;
  }

  async list({ limit, cursor }: PageRequest): Promise<CursorPage<Contact>> {
    // Busca um item a mais só para saber se existe próxima página.
    const rows = await this.db.contact.findMany({
      where: {
        tenantId: this.tenant.tenantId,
        ...(cursor && { id: { lt: cursor } }),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ContactMapper.toDomain(row));
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }
}

/**
 * Duas requisições simultâneas podem passar pela checagem do use case;
 * a constraint única do banco barra a segunda, e aqui ela vira erro de domínio.
 * Qualquer outro erro segue adiante sem tradução.
 */
function translateUniqueViolation(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
  if (error.code !== UNIQUE_VIOLATION) return error;

  const details = JSON.stringify(error.meta ?? {});
  for (const [constraint, field] of Object.entries(UNIQUE_CONSTRAINTS)) {
    if (details.includes(constraint)) return new ContactAlreadyExistsError(field);
  }
  return error;
}
