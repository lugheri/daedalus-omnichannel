import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/id-generator';
import {
  TENANT_CONTEXT,
  type TenantContext,
} from '../../../../../shared/application/tenant-context';
import { Disposition, type DispositionColor } from '../../../domain/disposition.entity';
import { DispositionInUseError } from '../../../domain/errors/disposition-in-use.error';
import { DispositionNameTakenError } from '../../../domain/errors/disposition-name-taken.error';
import { DispositionNotFoundError } from '../../../domain/errors/disposition-not-found.error';
import {
  DISPOSITION_REPOSITORY,
  type DispositionRepository,
} from '../../ports/disposition.repository';

/**
 * Catálogo de tabulações da conta. Listar é aberto a todo membro (para
 * tabular); criar, editar, arquivar e apagar exigem `dispositions:manage`
 * (checado na rota).
 */
@Injectable()
export class ListDispositionsUseCase {
  constructor(
    @Inject(DISPOSITION_REPOSITORY) private readonly dispositions: DispositionRepository,
  ) {}

  execute(): Promise<Disposition[]> {
    return this.dispositions.list();
  }
}

@Injectable()
export class CreateDispositionUseCase {
  constructor(
    @Inject(DISPOSITION_REPOSITORY) private readonly dispositions: DispositionRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { name: string; color: DispositionColor }): Promise<Disposition> {
    const disposition = Disposition.create(this.ids.generate(), {
      tenantId: this.tenant.tenantId,
      ...input,
    });
    await assertNameFree(this.dispositions, disposition.name);
    await this.dispositions.save(disposition);
    return disposition;
  }
}

@Injectable()
export class UpdateDispositionUseCase {
  constructor(
    @Inject(DISPOSITION_REPOSITORY) private readonly dispositions: DispositionRepository,
  ) {}

  /** Campo ausente = não muda. `archived` tira (ou devolve) das opções. */
  async execute(
    id: string,
    input: { name?: string; color?: DispositionColor; archived?: boolean },
  ): Promise<Disposition> {
    const disposition = await this.dispositions.findById(id);
    if (!disposition) throw new DispositionNotFoundError();

    disposition.update(input);
    await assertNameFree(this.dispositions, disposition.name, disposition.id);
    if (input.archived === true) disposition.archive();
    if (input.archived === false) disposition.unarchive();
    await this.dispositions.save(disposition);
    return disposition;
  }
}

@Injectable()
export class DeleteDispositionUseCase {
  constructor(
    @Inject(DISPOSITION_REPOSITORY) private readonly dispositions: DispositionRepository,
  ) {}

  /** Só a que nunca foi usada (erro de digitação); usada, arquive. */
  async execute(id: string): Promise<void> {
    const disposition = await this.dispositions.findById(id);
    if (!disposition) throw new DispositionNotFoundError();
    if (await this.dispositions.isUsed(id)) throw new DispositionInUseError();
    await this.dispositions.delete(id);
  }
}

async function assertNameFree(repo: DispositionRepository, name: string, selfId?: string) {
  const existing = await repo.findByName(name);
  if (existing && existing.id !== selfId) throw new DispositionNameTakenError();
}
