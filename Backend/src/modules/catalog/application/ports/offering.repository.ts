import type { Offering } from '../../domain/offering.entity';

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface OfferingRepository {
  /** Lança `CatalogConflictError('SERVICE_NAME_TAKEN')` se o nome já existir na conta. */
  save(offering: Offering): Promise<void>;
  findById(id: string): Promise<Offering | null>;
  findByIds(ids: string[]): Promise<Offering[]>;
  /** Por nome, inclusive os inativos. */
  list(): Promise<Offering[]>;
  delete(offering: Offering): Promise<void>;
}

export const OFFERING_REPOSITORY = Symbol('OfferingRepository');
