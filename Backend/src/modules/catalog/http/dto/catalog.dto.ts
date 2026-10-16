import { z } from 'zod';

/** Só o formato; tamanhos, faixas e referências são regras do domínio/use case. */
const text = z.string().max(5000);

export const createServiceSchema = z.object({
  name: text,
  description: text.nullable().default(null),
  durationMinutes: z.number(),
  priceCents: z.number().nullable(),
  showOnSite: z.boolean().default(true),
});
export type CreateServiceDto = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  name: text.optional(),
  description: text.nullable().optional(),
  durationMinutes: z.number().optional(),
  priceCents: z.number().nullable().optional(),
  showOnSite: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;

const serviceIds = z.array(z.uuid()).max(200);

export const createProfessionalSchema = z.object({
  name: text,
  title: text.nullable().default(null),
  bio: text.nullable().default(null),
  membershipId: z.uuid().nullable().default(null),
  serviceIds: serviceIds.default([]),
  showOnSite: z.boolean().default(true),
});
export type CreateProfessionalDto = z.infer<typeof createProfessionalSchema>;

export const updateProfessionalSchema = z.object({
  name: text.optional(),
  title: text.nullable().optional(),
  bio: text.nullable().optional(),
  membershipId: z.uuid().nullable().optional(),
  serviceIds: serviceIds.optional(),
  showOnSite: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type UpdateProfessionalDto = z.infer<typeof updateProfessionalSchema>;
