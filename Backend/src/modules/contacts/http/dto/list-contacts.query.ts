import { z } from 'zod';
import { LEAD_SOURCES } from '../../domain/lead-source';

export const listContactsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.uuid().optional(),
  /** Busca por nome, e-mail ou telefone. */
  q: z.string().trim().max(100).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
});

export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
