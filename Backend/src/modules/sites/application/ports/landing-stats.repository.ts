import type { VariantNumbers } from '../../domain/ab-test';

/** Visitas e conversões das variantes da conta atual. */
export interface LandingStatsRepository {
  /** +1 visita no dia (`AAAA-MM-DD`, UTC). */
  recordView(variantId: string, day: string): Promise<void>;
  /** Uma conversão (o id é o do envio do formulário: repetido não conta de novo). */
  recordConversion(conversion: {
    id: string;
    landingPageId: string;
    variantId: string;
    at: Date;
  }): Promise<void>;
  /** Totais por variante (as sem números ficam de fora do mapa). */
  totals(variantIds: string[]): Promise<Map<string, VariantNumbers>>;
  /** Zera os números (recomeçar o teste ou variante excluída). */
  clear(variantIds: string[]): Promise<void>;
}

export const LANDING_STATS_REPOSITORY = Symbol('LandingStatsRepository');
