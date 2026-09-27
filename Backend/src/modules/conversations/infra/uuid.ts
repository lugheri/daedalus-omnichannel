const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids vindos de fora (URL) que não são UUID nunca existem — e o Postgres recusaria. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
