import { z } from 'zod';
import { LEAD_SOURCES } from '../../../contacts';

const audienceSchema = z.object({
  search: z.string().trim().max(100).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  sourceDetail: z.string().trim().max(200).optional(),
});

/** Só o formato; tamanhos e regras ficam no domínio. */
export const createCampaignSchema = z.object({
  name: z.string().max(500),
  channel: z.enum(['email', 'sms']),
  subject: z.string().max(1000).nullish(),
  body: z.string().max(50_000),
  audience: audienceSchema,
});
export type CreateCampaignDto = z.infer<typeof createCampaignSchema>;

/** Campo ausente = não muda (o canal não muda depois de criada). */
export const updateCampaignSchema = createCampaignSchema.omit({ channel: true }).partial();
export type UpdateCampaignDto = z.infer<typeof updateCampaignSchema>;

/** `at` null = enviar agora. */
export const scheduleCampaignSchema = z.object({
  at: z.iso.datetime({ offset: true }).nullable(),
});
export type ScheduleCampaignDto = z.infer<typeof scheduleCampaignSchema>;

export const previewAudienceSchema = z.object({
  channel: z.enum(['email', 'sms']),
  audience: audienceSchema,
});
export type PreviewAudienceDto = z.infer<typeof previewAudienceSchema>;

export const listCampaignsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

export const recipientsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['queued', 'sent', 'delivered', 'failed', 'bounced']).optional(),
});
export type RecipientsQuery = z.infer<typeof recipientsQuerySchema>;
