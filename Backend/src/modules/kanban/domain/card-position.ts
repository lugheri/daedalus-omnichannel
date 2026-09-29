/** Menor distância entre vizinhos antes de renumerar a coluna. */
const MIN_GAP = 1e-6;

/**
 * Posição para um card entre dois vizinhos (ordem crescente = de cima para
 * baixo). Sem vizinho acima, vai 1 antes do de baixo; sem o de baixo, 1
 * depois do de cima; coluna vazia, 0.
 *
 * Devolve `null` quando os vizinhos estão colados demais (depois de muitas
 * inserções no mesmo ponto): a coluna precisa ser renumerada antes.
 */
export function positionBetween(above: number | null, below: number | null): number | null {
  if (above === null && below === null) return 0;
  if (above === null) return below! - 1;
  if (below === null) return above + 1;
  if (below - above < MIN_GAP) return null;
  return (above + below) / 2;
}
