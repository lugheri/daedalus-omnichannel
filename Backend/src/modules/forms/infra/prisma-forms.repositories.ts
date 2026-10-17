import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import type { FormModel, FormSubmissionModel } from '../../../shared/infra/prisma/generated/models';
import type { PrismaService } from '../../../shared/infra/prisma/prisma.service';
import type { FormRepository } from '../application/ports/form.repository';
import type { SubmissionRepository } from '../application/ports/submission.repository';
import { Form, type FormKind } from '../domain/form.entity';
import type { FormSubmission } from '../domain/submission';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaFormRepository implements FormRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(form: Form): Promise<void> {
    const tenantId = this.tenant.tenantId;
    const data = {
      name: form.name,
      publicKey: form.publicKey,
      campaign: form.campaign,
      successUrl: form.successUrl,
      active: form.active,
    };
    await this.db.form.upsert({
      where: { id: form.id, tenantId },
      create: { id: form.id, tenantId, kind: form.kind, createdAt: form.createdAt, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<Form | null> {
    if (!UUID.test(id)) return null;
    const row = await this.db.form.findFirst({ where: { id, tenantId: this.tenant.tenantId } });
    return row ? toForm(row) : null;
  }

  async list(): Promise<Form[]> {
    const rows = await this.db.form.findMany({
      where: { tenantId: this.tenant.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toForm);
  }

  async delete(form: Form): Promise<void> {
    // Os envios saem junto (ON DELETE CASCADE).
    await this.db.form.deleteMany({ where: { id: form.id, tenantId: this.tenant.tenantId } });
  }

  async findByPublicKeyAsSystem(publicKey: string): Promise<Form | null> {
    if (!publicKey || publicKey.length > 100) return null;
    // Sem filtro de tenant DE PROPÓSITO: a chave é o que diz a conta (ver o port).
    const row = await this.db.form.findUnique({ where: { publicKey } });
    return row ? toForm(row) : null;
  }
}

@Injectable()
export class PrismaSubmissionRepository implements SubmissionRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async save(s: FormSubmission): Promise<void> {
    await this.db.formSubmission.create({ data: { ...s, tenantId: this.tenant.tenantId } });
  }

  async listByForm(formId: string, limit: number): Promise<FormSubmission[]> {
    if (!UUID.test(formId)) return [];
    const rows = await this.db.formSubmission.findMany({
      where: { formId, tenantId: this.tenant.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toSubmission);
  }

  async listByContact(contactId: string, limit: number): Promise<FormSubmission[]> {
    if (!UUID.test(contactId)) return [];
    const rows = await this.db.formSubmission.findMany({
      where: { contactId, tenantId: this.tenant.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toSubmission);
  }

  async countByForm(formIds: string[]): Promise<Map<string, number>> {
    if (formIds.length === 0) return new Map();
    const groups = await this.db.formSubmission.groupBy({
      by: ['formId'],
      where: { tenantId: this.tenant.tenantId, formId: { in: formIds } },
      _count: { _all: true },
    });
    return new Map(groups.map((g) => [g.formId, g._count._all]));
  }
}

function toForm(row: FormModel): Form {
  return Form.restore(row.id, {
    tenantId: row.tenantId,
    name: row.name,
    kind: row.kind as FormKind,
    publicKey: row.publicKey,
    campaign: row.campaign,
    successUrl: row.successUrl,
    active: row.active,
    createdAt: row.createdAt,
  });
}

function toSubmission(row: FormSubmissionModel): FormSubmission {
  return { ...row };
}
