import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  type PlanFeature,
  type PlanLimit,
} from '../../../shared/domain/plan-entitlement';
import { InvalidPlanError } from './errors/plan.errors';

/** Limite por item: quantos (null = sem limite). */
export type PlanLimits = Record<PlanLimit, number | null>;
export type PlanFeatures = Record<PlanFeature, boolean>;

const MAX_LIMIT = 100_000;

export interface PlanDetails {
  name: string;
  description: string | null;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Revendedores podem dar este plano às contas abaixo deles. */
  resellable: boolean;
}

export interface PlanProps extends PlanDetails {
  /** O plano de quem não tem plano escolhido (cadastro novo, contas antigas). Só um. */
  isDefault: boolean;
  /** Fora da escolha; as contas que já usam continuam nele. */
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plano (ADR 0015): o que uma conta pode ter (limites) e usar (recursos).
 * Catálogo da plataforma — não é de nenhuma conta. Limites de plano são
 * *entitlements* da conta, não permissões (ADR 0003).
 */
export class Plan extends AggregateRoot<PlanProps> {
  static create(id: string, details: PlanDetails): Plan {
    const now = new Date();
    return new Plan(id, {
      ...validDetails(details),
      isDefault: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: PlanProps): Plan {
    return new Plan(id, props);
  }

  update(changes: Partial<PlanDetails>): void {
    Object.assign(this.props, validDetails({ ...this.details, ...defined(changes) }));
    this.props.updatedAt = new Date();
  }

  archive(): void {
    this.props.archived = true;
    this.props.updatedAt = new Date();
  }

  unarchive(): void {
    this.props.archived = false;
    this.props.updatedAt = new Date();
  }

  markDefault(isDefault: boolean): void {
    this.props.isDefault = isDefault;
    if (isDefault) this.props.archived = false;
    this.props.updatedAt = new Date();
  }

  limitOf(limit: PlanLimit): number | null {
    return this.props.limits[limit];
  }

  has(feature: PlanFeature): boolean {
    return this.props.features[feature];
  }

  private get details(): PlanDetails {
    const { name, description, limits, features, resellable } = this.props;
    return { name, description, limits, features, resellable };
  }

  get name() {
    return this.props.name;
  }
  get description() {
    return this.props.description;
  }
  get limits(): PlanLimits {
    return { ...this.props.limits };
  }
  get features(): PlanFeatures {
    return { ...this.props.features };
  }
  get resellable() {
    return this.props.resellable;
  }
  get isDefault() {
    return this.props.isDefault;
  }
  get archived() {
    return this.props.archived;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}

function defined<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function validDetails(input: PlanDetails): PlanDetails {
  const name = input.name.trim();
  if (!name || name.length > 60) throw new InvalidPlanError('PLAN_INVALID_NAME');
  const limits = {} as PlanLimits;
  for (const key of PLAN_LIMITS) {
    const value = input.limits[key] ?? null;
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_LIMIT)) {
      throw new InvalidPlanError('PLAN_INVALID_LIMIT');
    }
    limits[key] = value;
  }
  const features = {} as PlanFeatures;
  for (const key of PLAN_FEATURES) features[key] = input.features[key] === true;
  return {
    name,
    description: input.description?.trim().slice(0, 300) || null,
    limits,
    features,
    resellable: input.resellable,
  };
}

/** Limites e recursos completos a partir do JSON gravado (item novo no catálogo = sem limite / sem o recurso). */
export function completeLimits(stored: Partial<Record<string, number | null>>): PlanLimits {
  return Object.fromEntries(PLAN_LIMITS.map((k) => [k, stored[k] ?? null])) as PlanLimits;
}

export function completeFeatures(stored: Partial<Record<string, boolean>>): PlanFeatures {
  return Object.fromEntries(PLAN_FEATURES.map((k) => [k, stored[k] === true])) as PlanFeatures;
}
