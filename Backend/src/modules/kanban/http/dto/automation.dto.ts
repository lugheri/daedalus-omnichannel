import { z } from 'zod';

/** Só o formato; combinações gatilho × ações e limites ficam no domínio. */
export const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('card_entered') }),
  z.object({ type: z.literal('card_idle'), minutes: z.number().int() }),
  z.object({ type: z.literal('disposition_set'), dispositionId: z.uuid() }),
  z.object({ type: z.literal('conversation_resolved') }),
  z.object({ type: z.literal('customer_replied') }),
]);

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('send_message'), text: z.string().max(5000) }),
  z.object({
    type: z.literal('assign'),
    teamId: z.uuid().nullable().optional(),
    assigneeId: z.uuid().nullable().optional(),
  }),
  z.object({ type: z.literal('move'), columnId: z.uuid() }),
]);

export const createAutomationSchema = z.object({
  columnId: z.uuid(),
  trigger: triggerSchema,
  actions: z.array(actionSchema).max(10).default([]),
  enabled: z.boolean().optional(),
});
export type CreateAutomationDto = z.infer<typeof createAutomationSchema>;

/** Campo ausente = não muda. */
export const updateAutomationSchema = z
  .object({
    trigger: triggerSchema.optional(),
    actions: z.array(actionSchema).max(10).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Nada para alterar',
  });
export type UpdateAutomationDto = z.infer<typeof updateAutomationSchema>;
