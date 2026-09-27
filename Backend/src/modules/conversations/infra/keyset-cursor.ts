import { isUuid } from './uuid';

/**
 * Cursor de paginação por (data, id) — listas ordenadas por data, em que
 * várias linhas podem ter a mesma data. Opaco para o cliente: base64url de
 * `<ISO>|<id>`.
 */
export interface Keyset {
  at: Date;
  id: string;
}

export function encodeKeyset({ at, id }: Keyset): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
}

/** Cursor inválido = primeira página (não vale um erro para o usuário). */
export function decodeKeyset(cursor: string | undefined): Keyset | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) || !isUuid(id ?? '') ? null : { at, id };
}

/** Filtro Prisma "depois deste item" na ordem (campo desc, id desc). */
export function afterKeyset<F extends string>(field: F, keyset: Keyset) {
  return {
    OR: [{ [field]: { lt: keyset.at } }, { [field]: keyset.at, id: { lt: keyset.id } }],
  } as { OR: ({ [K in F]: { lt: Date } } | ({ [K in F]: Date } & { id: { lt: string } }))[] };
}
