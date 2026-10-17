import { z } from 'zod';

/** Só o formato; tamanhos e regras do funil e do negócio ficam no domínio. */
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
  .object({
    name: z.string().max(200).optional(),
    autoAdd: autoAddSchema.optional(),
    /** Leads do formulário do site entram na primeira etapa. */
    autoAddLeads: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.autoAdd !== undefined || v.autoAddLeads !== undefined, {
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

export const listDealsQuerySchema = z.object({
  /** Uma etapa só ("carregar mais"), a partir do `cursor` dela. */
  columnId: z.uuid().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;

const valueCents = z.number().int().nullable();

export const createDealSchema = z
  .object({
    boardId: z.uuid(),
    /** Ausente = primeira etapa. */
    columnId: z.uuid().optional(),
    contactId: z.uuid().optional(),
    conversationId: z.uuid().optional(),
    title: z.string().max(500).optional(),
    valueCents: valueCents.optional(),
    /** Ausente = quem cria; null = ninguém. */
    ownerId: z.uuid().nullable().optional(),
  })
  .refine((v) => v.contactId || v.conversationId, { message: 'Informe o contato ou a conversa' });
export type CreateDealDto = z.infer<typeof createDealSchema>;

export const updateDealSchema = z
  .object({
    title: z.string().max(500).optional(),
    valueCents: valueCents.optional(),
    ownerId: z.uuid().nullable().optional(),
    conversationId: z.uuid().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nada para alterar' });
export type UpdateDealDto = z.infer<typeof updateDealSchema>;

export const moveDealSchema = z.object({
  columnId: z.uuid(),
  /** O negócio que fica logo acima no destino; null = topo. */
  afterDealId: z.uuid().nullable(),
});
export type MoveDealDto = z.infer<typeof moveDealSchema>;

export const dealStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('won') }),
  z.object({ status: z.literal('lost'), lostReason: z.string().max(2000).nullable().optional() }),
  z.object({ status: z.literal('open') }),
]);
export type DealStatusDto = z.infer<typeof dealStatusSchema>;

/** Negócios de um contato (ficha) ou de uma conversa (chat) — um dos dois. */
export const dealsQuerySchema = z.union([
  z.object({ contactId: z.uuid() }),
  z.object({ conversationId: z.uuid() }),
]);
export type DealsQuery = z.infer<typeof dealsQuerySchema>;
