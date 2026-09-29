import { z } from 'zod';

/** Só o formato; as regras (e-mail válido, SID, remetente) ficam no domínio. */
export const saveEmailProviderSchema = z.object({
  fromEmail: z.string().max(320),
  fromName: z.string().max(200),
  replyTo: z.string().max(320).nullish(),
  /** Chave pública do Signed Event Webhook do SendGrid (opcional). */
  eventWebhookKey: z.string().max(2000).nullish(),
  /** Ausente = manter a chave salva. */
  apiKey: z.string().max(500).optional(),
});
export type SaveEmailProviderDto = z.infer<typeof saveEmailProviderSchema>;

export const saveSmsProviderSchema = z.object({
  accountSid: z.string().max(100),
  /** Ausente = manter o token salvo. */
  authToken: z.string().max(500).optional(),
  from: z.string().max(40).nullish(),
  messagingServiceSid: z.string().max(100).nullish(),
});
export type SaveSmsProviderDto = z.infer<typeof saveSmsProviderSchema>;

export const channelParamSchema = z.enum(['email', 'sms']);

export const sendTestSchema = z.object({ to: z.string().min(1).max(320) });
export type SendTestDto = z.infer<typeof sendTestSchema>;

export const sendToContactSchema = z.object({
  channel: z.enum(['email', 'sms']),
  subject: z.string().max(1000).nullish(),
  body: z.string().max(50_000),
});
export type SendToContactDto = z.infer<typeof sendToContactSchema>;
