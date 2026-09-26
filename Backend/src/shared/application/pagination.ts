/**
 * Paginação por cursor: estável sob inserções concorrentes e eficiente em
 * tabelas grandes (não usa OFFSET). O cursor é o id do último item da página.
 */
export interface PageRequest {
  limit: number;
  cursor?: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
