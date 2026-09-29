import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import {
  TENANT_CONTEXT,
  type TenantContext,
} from '../../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { DomainError } from '../../../../../shared/domain/domain-error';
import { Contact } from '../../../domain/contact.entity';
import { EmptyImportError } from '../../../domain/errors/empty-import.error';
import { ImportTooLargeError } from '../../../domain/errors/import-too-large.error';
import { ImportWithoutColumnsError } from '../../../domain/errors/import-without-columns.error';
import { decodeSpreadsheet, detectDelimiter, mapColumns, parseCsv } from '../../import/csv';
import { CONTACT_REPOSITORY, type ContactRepository } from '../../ports/contact.repository';

/** Acima disto, a importação iria para a fila (processamento em segundo plano). */
export const MAX_IMPORT_ROWS = 2000;
/** Contatos gravados por transação. */
const BATCH = 200;

export interface ImportReport {
  total: number;
  created: number;
  /** Já existiam na conta, ou apareciam antes no mesmo arquivo. */
  duplicates: number;
  /** Linha da planilha (a 1 é o cabeçalho) e o código do erro de domínio. */
  errors: { line: number; code: string }[];
}

/**
 * Importa contatos de um CSV (origem `import`, com um rótulo do lote, ex.:
 * "Feira 2026"). Linha inválida não impede as outras: vira erro no relatório.
 * Duplicados (na conta ou no próprio arquivo) são pulados, nunca sobrescritos.
 */
@Injectable()
export class ImportContactsUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: { content: Buffer; label?: string | null }): Promise<ImportReport> {
    const text = decodeSpreadsheet(input.content);
    const [header, ...rows] = parseCsv(text, detectDelimiter(text));
    if (!header) throw new EmptyImportError();
    const columns = mapColumns(header);
    if (columns.phone === undefined && columns.email === undefined) {
      throw new ImportWithoutColumnsError();
    }

    const lines = rows
      .map((cells, index) => ({ cells, line: index + 2 }))
      .filter(({ cells }) => cells.some((cell) => cell.trim() !== ''));
    if (lines.length === 0) throw new EmptyImportError();
    if (lines.length > MAX_IMPORT_ROWS) throw new ImportTooLargeError();

    const cell = (cells: string[], column?: number) =>
      column === undefined ? null : cells[column]?.trim() || null;

    const report: ImportReport = { total: lines.length, created: 0, duplicates: 0, errors: [] };
    const candidates: Contact[] = [];
    for (const { cells, line } of lines) {
      try {
        candidates.push(
          Contact.create(this.ids.generate(), {
            tenantId: this.tenant.tenantId,
            name: cell(cells, columns.name),
            phone: cell(cells, columns.phone),
            email: cell(cells, columns.email),
            source: 'import',
            sourceDetail: input.label,
          }),
        );
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        report.errors.push({ line, code: error.code });
      }
    }

    // Duplicados: uma consulta para o lote inteiro, mais o que já passou no arquivo.
    const existing = await this.contacts.findExistingIdentifiers(
      candidates.flatMap((c) => (c.phone ? [c.phone.value] : [])),
      candidates.flatMap((c) => (c.email ? [c.email.value] : [])),
    );
    const toCreate = candidates.filter((contact) => {
      const phone = contact.phone?.value;
      const email = contact.email?.value;
      if ((phone && existing.phones.has(phone)) || (email && existing.emails.has(email))) {
        report.duplicates++;
        return false;
      }
      if (phone) existing.phones.add(phone);
      if (email) existing.emails.add(email);
      return true;
    });

    for (let i = 0; i < toCreate.length; i += BATCH) {
      const batch = toCreate.slice(i, i + BATCH);
      await this.unitOfWork.run(async () => {
        for (const contact of batch) {
          await this.contacts.save(contact);
          await this.events.publish(contact.pullEvents());
        }
      });
      report.created += batch.length;
    }
    return report;
  }
}
