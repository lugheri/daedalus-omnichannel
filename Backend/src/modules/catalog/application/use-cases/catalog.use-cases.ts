import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { CatalogItemNotFoundError } from '../../domain/errors/catalog-item-not-found.error';
import { InvalidCatalogItemError } from '../../domain/errors/invalid-catalog-item.error';
import { Offering, type OfferingDetails } from '../../domain/offering.entity';
import { Professional, type ProfessionalDetails } from '../../domain/professional.entity';
import { MEMBER_DIRECTORY, type MemberDirectory } from '../ports/member-directory';
import { OFFERING_REPOSITORY, type OfferingRepository } from '../ports/offering.repository';
import {
  PROFESSIONAL_REPOSITORY,
  type ProfessionalRepository,
} from '../ports/professional.repository';

async function loadOffering(offerings: OfferingRepository, id: string): Promise<Offering> {
  const offering = await offerings.findById(id);
  if (!offering) throw new CatalogItemNotFoundError('SERVICE_NOT_FOUND');
  return offering;
}

async function loadProfessional(
  professionals: ProfessionalRepository,
  id: string,
): Promise<Professional> {
  const professional = await professionals.findById(id);
  if (!professional) throw new CatalogItemNotFoundError('PROFESSIONAL_NOT_FOUND');
  return professional;
}

// ── serviços ─────────────────────────────────────────────────────────────

@Injectable()
export class ListOfferingsUseCase {
  constructor(@Inject(OFFERING_REPOSITORY) private readonly offerings: OfferingRepository) {}

  execute(): Promise<Offering[]> {
    return this.offerings.list();
  }
}

@Injectable()
export class CreateOfferingUseCase {
  constructor(
    @Inject(OFFERING_REPOSITORY) private readonly offerings: OfferingRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: OfferingDetails): Promise<Offering> {
    const offering = Offering.create(this.ids.generate(), {
      ...input,
      tenantId: this.tenant.tenantId,
    });
    await this.offerings.save(offering);
    return offering;
  }
}

@Injectable()
export class UpdateOfferingUseCase {
  constructor(@Inject(OFFERING_REPOSITORY) private readonly offerings: OfferingRepository) {}

  async execute(
    offeringId: string,
    changes: Partial<OfferingDetails> & { active?: boolean },
  ): Promise<Offering> {
    const offering = await loadOffering(this.offerings, offeringId);
    offering.update(changes);
    await this.offerings.save(offering);
    return offering;
  }
}

/**
 * Exclui o serviço e o tira da lista de quem o fazia. Com a agenda, serviço
 * com atendimento marcado passará a ser só desativado — o histórico precisa
 * do nome.
 */
@Injectable()
export class DeleteOfferingUseCase {
  constructor(
    @Inject(OFFERING_REPOSITORY) private readonly offerings: OfferingRepository,
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionals: ProfessionalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(offeringId: string): Promise<void> {
    await this.unitOfWork.run(async () => {
      const offering = await loadOffering(this.offerings, offeringId);
      for (const professional of await this.professionals.listByOffering(offering.id)) {
        professional.dropOffering(offering.id);
        await this.professionals.save(professional);
      }
      await this.offerings.delete(offering);
    });
  }
}

// ── profissionais ────────────────────────────────────────────────────────

type ProfessionalInput = ProfessionalDetails & { offeringIds: string[] };

/** Serviços e membro vinculado precisam existir (e estar ativos) nesta conta. */
@Injectable()
export class ProfessionalReferences {
  constructor(
    @Inject(OFFERING_REPOSITORY) private readonly offerings: OfferingRepository,
    @Inject(MEMBER_DIRECTORY) private readonly members: MemberDirectory,
  ) {}

  async check(input: { offeringIds?: string[]; membershipId?: string | null }): Promise<void> {
    if (input.offeringIds?.length) {
      const wanted = [...new Set(input.offeringIds)];
      const found = await this.offerings.findByIds(wanted);
      if (found.length !== wanted.length) {
        throw new InvalidCatalogItemError('PROFESSIONAL_UNKNOWN_SERVICES');
      }
    }
    if (input.membershipId) {
      const active = await this.members.activeMemberIds([input.membershipId]);
      if (active.length === 0) throw new InvalidCatalogItemError('PROFESSIONAL_INVALID_MEMBER');
    }
  }
}

@Injectable()
export class ListProfessionalsUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionals: ProfessionalRepository,
  ) {}

  execute(): Promise<Professional[]> {
    return this.professionals.list();
  }
}

@Injectable()
export class CreateProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionals: ProfessionalRepository,
    private readonly references: ProfessionalReferences,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: ProfessionalInput): Promise<Professional> {
    const professional = Professional.create(this.ids.generate(), {
      ...input,
      tenantId: this.tenant.tenantId,
    });
    await this.references.check(input);
    await this.professionals.save(professional);
    return professional;
  }
}

@Injectable()
export class UpdateProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionals: ProfessionalRepository,
    private readonly references: ProfessionalReferences,
  ) {}

  async execute(
    professionalId: string,
    changes: Partial<ProfessionalInput> & { active?: boolean },
  ): Promise<Professional> {
    const professional = await loadProfessional(this.professionals, professionalId);
    // Só confere o membro se ele mudou: um membro desativado depois continua
    // vinculado até alguém trocar — editar o nome não pode falhar por isso.
    const memberChanged =
      changes.membershipId !== undefined && changes.membershipId !== professional.membershipId;
    await this.references.check({
      offeringIds: changes.offeringIds,
      membershipId: memberChanged ? changes.membershipId : null,
    });
    professional.update(changes);
    await this.professionals.save(professional);
    return professional;
  }
}

@Injectable()
export class DeleteProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionals: ProfessionalRepository,
  ) {}

  async execute(professionalId: string): Promise<void> {
    const professional = await loadProfessional(this.professionals, professionalId);
    await this.professionals.delete(professional);
  }
}
