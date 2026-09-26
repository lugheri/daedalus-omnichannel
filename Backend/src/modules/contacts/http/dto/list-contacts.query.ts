import { z } from 'zod';

export const listContactsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.uuid().optional(),
});

export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
