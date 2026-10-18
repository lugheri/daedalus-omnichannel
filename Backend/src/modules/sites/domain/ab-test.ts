/**
 * Comparação de uma variante com a de controle (a primeira) num teste A/B:
 * teste de duas proporções (z, bicaudal). Só diz "confiável" com amostra
 * mínima — antes disso qualquer diferença pode ser sorte.
 */

/** Visitas mínimas em cada variante antes de comparar. */
export const MIN_VIEWS = 100;
/** Confiança exigida: p < 0,05 (95%). */
export const SIGNIFICANCE = 0.05;

export interface VariantNumbers {
  views: number;
  conversions: number;
}

export type Verdict =
  /** Ainda poucas visitas. */
  | 'insufficient'
  /** A diferença ainda pode ser sorte. */
  | 'inconclusive'
  | 'better'
  | 'worse';

export interface Comparison {
  /** Diferença relativa da taxa (0,25 = 25% a mais); null se o controle não converteu. */
  lift: number | null;
  /** Probabilidade de a diferença ser sorte (null com amostra insuficiente). */
  pValue: number | null;
  verdict: Verdict;
}

export function conversionRate({ views, conversions }: VariantNumbers): number | null {
  return views > 0 ? Math.min(conversions / views, 1) : null;
}

export function compareVariants(control: VariantNumbers, variant: VariantNumbers): Comparison {
  const rateA = conversionRate(control);
  const rateB = conversionRate(variant);
  const lift = rateA && rateB !== null ? (rateB - rateA) / rateA : null;
  if (control.views < MIN_VIEWS || variant.views < MIN_VIEWS || rateA === null || rateB === null) {
    return { lift, pValue: null, verdict: 'insufficient' };
  }
  const pooled =
    Math.min(control.conversions + variant.conversions, control.views + variant.views) /
    (control.views + variant.views);
  const error = Math.sqrt(pooled * (1 - pooled) * (1 / control.views + 1 / variant.views));
  if (error === 0) return { lift, pValue: 1, verdict: 'inconclusive' };
  const z = (rateB - rateA) / error;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const verdict = pValue >= SIGNIFICANCE ? 'inconclusive' : z > 0 ? 'better' : 'worse';
  return { lift, pValue, verdict };
}

/** Distribuição normal acumulada (aproximação de Abramowitz-Stegun, erro < 1e-7). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
