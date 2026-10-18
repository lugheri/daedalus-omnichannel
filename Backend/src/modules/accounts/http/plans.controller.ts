import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import { PLAN_FEATURES, PLAN_LIMITS } from '../../../shared/domain/plan-entitlement';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import {
  CreatePlanUseCase,
  DeletePlanUseCase,
  ListAssignablePlansUseCase,
  ListPlansUseCase,
  SetDefaultPlanUseCase,
  UpdatePlanUseCase,
} from '../application/use-cases/plans/plans.use-cases';
import type { PlanFeatures, PlanLimits } from '../domain/plan.entity';
import { presentPlan } from './plans.presenter';
import { RequirePermissions } from './require-permissions.decorator';

const idParam = new ZodValidationPipe(z.uuid());
/** Quantos (null = sem limite); as regras (inteiro, faixa) ficam no domínio. */
const limitsSchema = z.object(
  Object.fromEntries(PLAN_LIMITS.map((k) => [k, z.number().nullable().default(null)])),
);
const featuresSchema = z.object(
  Object.fromEntries(PLAN_FEATURES.map((k) => [k, z.boolean().default(false)])),
);
const createSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(1000).nullable().default(null),
  limits: limitsSchema,
  features: featuresSchema,
  resellable: z.boolean().default(false),
});
const updateSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  limits: limitsSchema.optional(),
  features: featuresSchema.optional(),
  resellable: z.boolean().optional(),
  archived: z.boolean().optional(),
});

type Details = {
  limits?: Record<string, number | null>;
  features?: Record<string, boolean>;
};
const typed = <T extends Details>(body: T) => ({
  ...body,
  limits: body.limits as PlanLimits | undefined,
  features: body.features as PlanFeatures | undefined,
});

/**
 * Planos (ADR 0015). O catálogo é mantido na conta da plataforma
 * (`plans:manage` + conta raiz, conferida no use case); `GET assignable` é
 * para revendedores escolherem o plano das contas abaixo deles.
 */
@Controller('v1/plans')
export class PlansController {
  constructor(
    private readonly listPlans: ListPlansUseCase,
    private readonly createPlan: CreatePlanUseCase,
    private readonly updatePlan: UpdatePlanUseCase,
    private readonly setDefault: SetDefaultPlanUseCase,
    private readonly deletePlan: DeletePlanUseCase,
    private readonly listAssignable: ListAssignablePlansUseCase,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  @RequirePermissions('plans:manage')
  @Get()
  async list() {
    return (await this.listPlans.execute(this.actors.actor)).map(({ plan, accounts }) => ({
      ...presentPlan(plan),
      accounts,
    }));
  }

  /** Os que a conta atual pode dar às contas abaixo dela. */
  @RequirePermissions('accounts:children')
  @Get('assignable')
  async assignable() {
    return (await this.listAssignable.execute(this.actors.actor)).map(presentPlan);
  }

  @RequirePermissions('plans:manage')
  @Post()
  async create(@Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>) {
    const { limits, features, ...rest } = typed(body);
    return presentPlan(
      await this.createPlan.execute(this.actors.actor, {
        ...rest,
        limits,
        features,
      }),
    );
  }

  @RequirePermissions('plans:manage')
  @Patch(':id')
  async update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    return presentPlan(await this.updatePlan.execute(this.actors.actor, id, typed(body)));
  }

  /** Vira o plano de quem não tem plano escolhido. */
  @RequirePermissions('plans:manage')
  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  async makeDefault(@Param('id', idParam) id: string) {
    return presentPlan(await this.setDefault.execute(this.actors.actor, id));
  }

  /** Só sem conta nenhuma (409 `PLAN_IN_USE`; em uso, arquive). */
  @RequirePermissions('plans:manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', idParam) id: string) {
    await this.deletePlan.execute(this.actors.actor, id);
  }
}
