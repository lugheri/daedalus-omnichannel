import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { FormSubmittedEvent } from '../../../forms';
import { LANDING_REF_PREFIX } from '../landing-composer';
import {
  LANDING_PAGE_REPOSITORY,
  type LandingPageRepository,
} from '../ports/landing-page.repository';
import {
  LANDING_STATS_REPOSITORY,
  type LandingStatsRepository,
} from '../ports/landing-stats.repository';

/**
 * Envio de formulário vindo de uma landing page (`sourceRef = lp:<variante>`,
 * ADR 0014) conta como conversão da variante. O id do evento (o do envio)
 * é a chave: evento repetido não conta de novo.
 */
@Injectable()
export class LandingConversionHandler {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly pages: LandingPageRepository,
    @Inject(LANDING_STATS_REPOSITORY) private readonly stats: LandingStatsRepository,
  ) {}

  @HandlesDomainEvent(FormSubmittedEvent)
  async handle(event: DeliveredEvent<FormSubmittedEvent>): Promise<void> {
    const ref = event.sourceRef ?? null;
    if (!ref?.startsWith(LANDING_REF_PREFIX)) return;
    const variantId = ref.slice(LANDING_REF_PREFIX.length);
    const owner = await this.pages.findVariantOwnerAsSystem(variantId);
    // Variante de outra conta (ref forjado) ou excluída: não conta.
    if (!owner || owner.tenantId !== event.tenantId) return;
    await this.stats.recordConversion({
      id: event.aggregateId,
      landingPageId: owner.landingPageId,
      variantId,
      at: new Date(event.occurredAt),
    });
  }
}
