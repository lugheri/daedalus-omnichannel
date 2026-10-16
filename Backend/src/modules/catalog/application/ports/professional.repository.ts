import type { Professional } from '../../domain/professional.entity';

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface ProfessionalRepository {
  /**
   * Grava o profissional e os serviços dele. Lança
   * `CatalogConflictError('PROFESSIONAL_MEMBER_TAKEN')` se o membro já for outro profissional.
   */
  save(professional: Professional): Promise<void>;
  findById(id: string): Promise<Professional | null>;
  /** Por nome, inclusive os inativos. */
  list(): Promise<Professional[]>;
  /** Quem faz o serviço. */
  listByOffering(offeringId: string): Promise<Professional[]>;
  delete(professional: Professional): Promise<void>;
}

export const PROFESSIONAL_REPOSITORY = Symbol('ProfessionalRepository');
