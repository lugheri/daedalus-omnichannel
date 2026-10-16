/** Tira as chaves `undefined` (não vieram) — `null` continua valendo como "limpar". */
export function defined<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
