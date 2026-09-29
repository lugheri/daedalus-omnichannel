import { z } from 'zod';

/** Só o formato; tamanhos e regras do quadro ficam no domínio. */
export const createBoardSchema = z.object({
  name: z.string().max(200),
  /** Nomes das colunas, na ordem; ausente = colunas padrão. */
  columns: z.array(z.string().max(200)).min(1).max(20).optional(),
});
export type CreateBoardDto = z.infer<typeof createBoardSchema>;

const autoAddSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({ mode: z.literal('all') }),
  z.object({ mode: z.literal('team'), teamId: z.uuid() }),
]);

/** Campo ausente = não muda. */
export const updateBoardSchema = z
  .object({ name: z.string().max(200).optional(), autoAdd: autoAddSchema.optional() })
  .refine((v) => v.name !== undefined || v.autoAdd !== undefined, {
    message: 'Nada para alterar',
  });
export type UpdateBoardDto = z.infer<typeof updateBoardSchema>;

export const columnNameSchema = z.object({ name: z.string().max(200) });
export type ColumnNameDto = z.infer<typeof columnNameSchema>;

/** Renomear e/ou mudar de lugar (0 = primeira). */
export const updateColumnSchema = z
  .object({
    name: z.string().max(200).optional(),
    index: z.number().int().min(0).max(100).optional(),
  })
  .refine((v) => v.name !== undefined || v.index !== undefined, {
    message: 'Nada para alterar',
  });
export type UpdateColumnDto = z.infer<typeof updateColumnSchema>;

export const deleteColumnQuerySchema = z.object({ moveTo: z.uuid().optional() });
export type DeleteColumnQuery = z.infer<typeof deleteColumnQuerySchema>;

export const listCardsQuerySchema = z.object({
  /** Uma coluna só ("carregar mais"), a partir do `cursor` dela. */
  columnId: z.uuid().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;

export const addCardSchema = z.object({
  conversationId: z.uuid(),
  /** Ausente = primeira coluna. */
  columnId: z.uuid().optional(),
});
export type AddCardDto = z.infer<typeof addCardSchema>;

export const moveCardSchema = z.object({
  columnId: z.uuid(),
  /** O card que fica logo acima no destino; null = topo. */
  afterCardId: z.uuid().nullable(),
});
export type MoveCardDto = z.infer<typeof moveCardSchema>;

export const placementsQuerySchema = z.object({ conversationId: z.uuid() });
export type PlacementsQuery = z.infer<typeof placementsQuerySchema>;
